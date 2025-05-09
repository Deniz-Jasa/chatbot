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
      messageCount: messages.length,
    });

    // Writing style prompts
    const writingStylePrompts = {
      Normal: '',
      Concise:
        '<userStyle>Do not create artifacts. You may write in any programming language. Provide code directly in the chat using Markdown. Be concise. Use short sentences. Avoid details or elaboration. Respond directly. Write clear, simple emails without jargon. </userStyle>',
      Explanatory:
        '<userStyle>Provide detailed explanations and background context. Break down complex concepts into digestible parts. Use examples when helpful. Aim to educate the user thoroughly on the topic.</userStyle>',
      Formal:
        '<userStyle>Use a formal, professional tone. Avoid colloquialisms and casual language. Use precise vocabulary and maintain proper grammar throughout. Structure your responses in a logical, organized manner.</userStyle>',
    };

    const stylePrompt =
      writingStylePrompts[selectedWritingStyle] || '';

    // Log messages with attachments as they may cause issues
    for (const msg of messages) {
      if (msg.content && typeof msg.content !== 'string') {
        console.log(
          'Message with non-string content detected, may cause issues with Anthropic'
        );
      }
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage =
      getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', {
        status: 400,
      });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title =
        await generateTitleFromUserMessage({ message: userMessage });
      await saveChat({ id, userId: session.user.id, title });
    } else if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await saveMessages({
      messages: [
        { ...userMessage, createdAt: new Date(), chatId: id },
      ],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: stylePrompt
            ? `${systemPrompt({ selectedChatModel })}\n${stylePrompt}`
            : systemPrompt({ selectedChatModel }),
          messages,
          temperature: 1,
          
          experimental_activeTools:
            selectedChatModel === 'claude-3-5-haiku' || selectedChatModel === 'deepseek-r1'
              ? []
              : selectedWritingStyle === 'Concise'
              ? ['getWeather', 'requestSuggestions']
              : ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions'],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools:
            selectedChatModel === 'deepseek-r1'
              ? {}
              : selectedWritingStyle === 'Concise'
              ? {
                  getWeather,
                  requestSuggestions: requestSuggestions({ session, dataStream }),
                }
              : {
                  getWeather,
                  createDocument: createDocument({ session, dataStream }),
                  updateDocument: updateDocument({ session, dataStream }),
                  requestSuggestions: requestSuggestions({ session, dataStream }),
                },
          onFinish: async ({ response, reasoning }) => {
            console.log('onFinish called with response:', {
              messageCount: response.messages.length,
              messages: response.messages,
              reasoning,
            });

            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({ messages: response.messages, reasoning });
                console.log('After sanitization:', { sanitizedCount: sanitizedResponseMessages.length, sanitizedMessages: sanitizedResponseMessages });
                if (sanitizedResponseMessages.length > 0) {
                  const dbMessages = sanitizedResponseMessages.map((message) => ({ id: message.id, chatId: id, role: message.role, content: message.content, createdAt: new Date() }));
                  console.log('Attempting to save messages:', { count: dbMessages.length, messages: dbMessages });
                  await saveMessages({ messages: dbMessages });
                  console.log('Successfully saved messages to database');
                } else {
                  console.log('No messages to save after sanitization');
                }
              } catch (error) {
                console.error('Failed to save chat:', error);
              }
            }
          },
          experimental_telemetry: { isEnabled: isProductionEnvironment, functionId: 'stream-text' },
        });

        result.consumeStream();
        result.mergeIntoDataStream(dataStream, { sendReasoning: true });
      },
      onError: (error) => {
        console.error('Stream error occurred:', error);
        return 'Oops, an error occurred! If you uploaded images, please try again without attachments as they might not be supported with the current AI provider.';
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat request', details: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Not Found', { status: 404 });
  const session = await auth();
  if (!session || !session.user) return new Response('Unauthorized', { status: 401 });
  try {
    const chat = await getChatById({ id });
    if (chat.userId !== session.user.id) return new Response('Unauthorized', { status: 401 });
    await deleteChatById({ id });
    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', { status: 500 });
  }
}
