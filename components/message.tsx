import type { ChatRequestOptions, Message } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useMemo, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon, ChevronDownIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';

// Function to extract thinking content from Deepseek model responses
const extractThinkingContent = (content: string) => {
  if (!content) return { mainContent: '', thinkingContent: '', thinkingComplete: false, thinkingStartTime: null };
  
  // Check if content starts with <think> tag
  if (content.trimStart().startsWith('<think>')) {
    // For streaming responses - if we have an opening <think> tag but no closing tag yet
    const hasClosingTag = content.includes('</think>');
    
    if (hasClosingTag) {
      // Complete thinking tag with closing tag - extract and clean content
      const thinkRegex = /<think>([\s\S]*?)<\/think>/;
      const match = content.match(thinkRegex);
      
      if (match && match[1]) {
        // Replace the entire <think>...</think> tag with empty string to remove it from main content
        return {
          thinkingContent: match[1].trim(),
          mainContent: content.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
          thinkingComplete: true,
          thinkingStartTime: null // We don't know when thinking started since we're getting a completed thinking tag
        };
      }
    } else {
      // Streaming thinking content without closing tag yet - remove the opening tag
      // and treat everything after it as thinking content
      const thinkingContent = content.replace('<think>', '').trim();
      // Return empty main content since we're still in thinking mode
      return {
        thinkingContent,
        mainContent: '',
        thinkingComplete: false,
        thinkingStartTime: Date.now() // Track when thinking started
      };
    }
  }
  
  // No thinking content found or thinking is complete
  return { mainContent: content, thinkingContent: '', thinkingComplete: false, thinkingStartTime: null };
};

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
  
  // Parse content for Deepseek thinking tags
  const { mainContent, thinkingContent, thinkingComplete, thinkingStartTime: extractedStartTime } = useMemo(() => {
    if (typeof message.content !== 'string') return { 
      mainContent: '', 
      thinkingContent: '', 
      thinkingComplete: false, 
      thinkingStartTime: null 
    };
    return extractThinkingContent(message.content);
  }, [message.content]);
  
  // Track thinking start time
  useEffect(() => {
    if (extractedStartTime && !thinkingStartTime) {
      setThinkingStartTime(extractedStartTime);
    }
  }, [extractedStartTime, thinkingStartTime]);
  
  // Calculate thinking duration when thinking is complete
  useEffect(() => {
    if (thinkingComplete && thinkingStartTime && !thinkingDuration) {
      setThinkingDuration(Date.now() - thinkingStartTime);
    }
  }, [thinkingComplete, thinkingStartTime, thinkingDuration]);

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-7 group/message mt-4"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {/* {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )} */}

          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row justify-end gap-2"
              >
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

            {message.reasoning && (
              <MessageReasoning
                isLoading={isLoading}
                reasoning={message.reasoning}
              />
            )}

            {((mainContent || thinkingContent) || message.reasoning) && mode === 'view' && (
              <div
                data-testid="message-content"
                className="gap-2 items-start"
              >
                {/* {message.role === 'user' && !isReadonly && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        data-testid={`message-edit`}
                        variant="ghost"
                        className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                        onClick={() => {
                          setMode('edit');
                        }}
                      >
                        <PencilEditIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit message</TooltipContent>
                  </Tooltip>
                )} */}

                <div
                  className={cn('flex flex-col gap-4 text-sm', {
                    'bg-[#303030] text-white px-4 py-3 rounded-3xl':
                      message.role === 'user',
                  })}
                >
                  {/* Display thinking content dropdown at the top if present */}
                  {thinkingContent && message.role === 'assistant' && (
                    <MessageThinking 
                      thinkingContent={thinkingContent} 
                      thinkingDuration={thinkingDuration}
                    />
                  )}
                  
                  {/* Display main content below thinking section */}
                  {mainContent && <Markdown>{mainContent}</Markdown>}
                </div>
              </div>
            )}

            {message.content && mode === 'edit' && (
              <div className="gap-2 items-start">
                <div className="size-8" />

                <MessageEditor
                  key={message.id}
                  message={message}
                  setMode={setMode}
                  setMessages={setMessages}
                  reload={reload}
                />
              </div>
            )}

            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="flex flex-col gap-4">
                {message.toolInvocations.map((toolInvocation) => {
                  const { toolName, toolCallId, state, args } = toolInvocation;

                  if (state === 'result') {
                    const { result } = toolInvocation;

                    return (
                      <div key={toolCallId}>
                        {toolName === 'getWeather' ? (
                          <Weather weatherAtLocation={result} />
                        ) : toolName === 'createDocument' ? (
                          <DocumentPreview
                            isReadonly={isReadonly}
                            result={result}
                          />
                        ) : toolName === 'updateDocument' ? (
                          <DocumentToolResult
                            type="update"
                            result={result}
                            isReadonly={isReadonly}
                          />
                        ) : toolName === 'requestSuggestions' ? (
                          <DocumentToolResult
                            type="request-suggestions"
                            result={result}
                            isReadonly={isReadonly}
                          />
                        ) : (
                          <pre>{JSON.stringify(result, null, 2)}</pre>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.reasoning !== nextProps.message.reasoning)
      return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (
      !equal(
        prevProps.message.toolInvocations,
        nextProps.message.toolInvocations,
      )
    )
      return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl p-4 flex justify-start items-center"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={role}
    >
      <motion.div
        className="size-2 rounded-full bg-white ml-3"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
};


export const MessageThinking = ({ 
  thinkingContent, 
  thinkingDuration 
}: { 
  thinkingContent: string;
  thinkingDuration: number | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const variants = {
    collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
    expanded: { height: 'auto', opacity: 1, overflow: 'visible' },
  };
  
  // Format the thinking duration in milliseconds
  const formattedDuration = thinkingDuration 
    ? `${(thinkingDuration / 1000).toFixed(2)}s` 
    : null;

  return (
    <div className="mt-[-8px]">
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 text-xs pr-4"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={cn('transition-transform', {
            'rotate-180': isExpanded,
          })}>
            <ChevronDownIcon size={14} />
          </div>
          <div className="flex items-center gap-1.5">
            <span>{isExpanded ? "Hide" : "Show"} thinking</span>
            {formattedDuration && (
              <span className="text-xs text-muted-foreground">
                ({formattedDuration})
              </span>
            )}
          </div>
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-thinking"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            style={{ overflow: 'hidden' }}
            className="pl-4 text-zinc-600 dark:text-[#9C9C9C] border-l flex flex-col gap-4 mt-2"
          >
            <Markdown>{thinkingContent}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
