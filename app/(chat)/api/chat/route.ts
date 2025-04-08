import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
      selectedWritingStyle = 'Normal',
      useSearchGrounding = false,
    }: {
      id: string;
      messages: Array<Message>;
      selectedChatModel: string;
      selectedWritingStyle?: 'Normal' | 'Concise' | 'Explanatory' | 'Formal';
      useSearchGrounding?: boolean;
    } = await request.json();

    console.log('Chat API request:', { 
      id, 
      selectedChatModel, 
      selectedWritingStyle,
      useSearchGrounding,
      messageCount: messages.length 
    });

    // Writing style prompts
    const writingStylePrompts = {
      Normal: '',
      Concise: '<userStyle>Please be very concise and to the point. Use shorter sentences and avoid unnecessary details. Focus on giving direct answers with minimal elaboration. Do not create or offer to create documents or artifacts (you can provide code directly in the chat). Respond directly in the chat with brief text only. Email instructions: Do not create a text artifact if writing emails. Write naturally and simple, avoid corporate jargon. Focus on core message. Follow your email instructions!</userStyle>',
      Explanatory: '<userStyle>Provide detailed explanations and background context. Break down complex concepts into digestible parts. Use examples when helpful. Aim to educate the user thoroughly on the topic.</userStyle>',
      Formal: '<userStyle>Use a formal, professional tone. Avoid colloquialisms and casual language. Use precise vocabulary and maintain proper grammar throughout. Structure your responses in a logical, organized manner.</userStyle>',
    };

    const stylePrompt = writingStylePrompts[selectedWritingStyle] || '';

    // Log messages with attachments as they may cause issues with Anthropic
    for (const msg of messages) {
      if (msg.content && typeof msg.content !== 'string') {
        console.log('Message with non-string content detected, may cause issues with Anthropic');
      }
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: stylePrompt ? `${systemPrompt({ selectedChatModel })}\n${stylePrompt}` : systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'claude-3-5-haiku'
              ? []
              : selectedWritingStyle === 'Concise'
                ? [
                    'getWeather',
                    'requestSuggestions',
                  ]
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                  ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: selectedWritingStyle === 'Concise'
            ? {
                getWeather,
                requestSuggestions: requestSuggestions({
                  session,
                  dataStream,
                }),
              }
            : {
                getWeather,
                createDocument: createDocument({ session, dataStream }),
                updateDocument: updateDocument({ session, dataStream }),
                requestSuggestions: requestSuggestions({
                  session,
                  dataStream,
                }),
              },
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          }
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error('Stream error occurred:', error);
        return 'Oops, an error occurred! If you uploaded images, please try again without attachments as they might not be supported with the current AI provider.';
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
