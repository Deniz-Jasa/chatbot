'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize, useOnClickOutside } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon, MicIcon, SearchIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import equal from 'fast-deep-equal';
import { UseChatHelpers, UseChatOptions } from '@ai-sdk/react';
import { VoiceModal } from './voice-modal';

// Client-only component wrapper
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Use a slight delay to ensure hydration is fully complete
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!mounted) {
    // Return a placeholder during SSR and initial client render
    return <div className="h-7 w-24 opacity-0" aria-hidden="true" />;
  }
  
  return <>{children}</>;
};

// Writing style definitions
type WritingStyle = 'Normal' | 'Concise' | 'Explanatory' | 'Formal';

const writingStylePrompts: Record<WritingStyle, string> = {
  Normal: '',
  Concise: '<userStyle>Please be very concise and to the point. Use shorter sentences and avoid unnecessary details. Focus on giving direct answers with minimal elaboration. Do not create or offer to create documents. Respond directly in the chat with brief text only. If editing or asked to proofread an email, write a concise and natural human-sounding email. Keep it focused on the message, avoiding fluff, corporate jargon, or overly formal language.</userStyle>',
  Explanatory: '<userStyle>Provide detailed explanations and background context. Break down complex concepts into digestible parts. Use examples when helpful. Aim to educate the user thoroughly on the topic.</userStyle>',
  Formal: '<userStyle>Use a formal, professional tone. Avoid colloquialisms and casual language. Use precise vocabulary and maintain proper grammar throughout. Structure your responses in a logical, organized manner.</userStyle>',
};

// Color mapping for different writing styles
const styleColorMap: Record<WritingStyle, {bg: string, darkBg: string, text: string, darkText: string}> = {
  Normal: {bg: '', darkBg: '', text: '', darkText: ''}, // No special color for Normal
  Concise: {bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30', text: 'text-blue-700', darkText: 'dark:text-blue-300'},
  Explanatory: {bg: 'bg-amber-100', darkBg: 'dark:bg-amber-900/30', text: 'text-amber-700', darkText: 'dark:text-amber-300'},
  Formal: {bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/30', text: 'text-purple-700', darkText: 'dark:text-purple-300'},
};

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Close dropdown when clicking outside
  useOnClickOutside(styleDropdownRef, () => {
    setStyleDropdownOpen(false);
  });

  // useEffect(() => {
  //   if (textareaRef.current) {
  //     adjustHeight();
  //   }
  // }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      const minHeight = 98; // Set minimum height in pixels
      textareaRef.current.style.height = `${minHeight}px`; // Set initial height
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(scrollHeight, minHeight)}px`;
    }
  };

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '105px';
    }
  }, [textareaRef]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      // adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInput(value);
    
    // Immediate height adjustment
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const minHeight = 98;
        textareaRef.current.style.height = 'auto';
        const scrollHeight = textareaRef.current.scrollHeight;
        textareaRef.current.style.height = `${Math.max(scrollHeight, minHeight)}px`;
      }
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedStyle, setSelectedStyleState] = useState<WritingStyle>('Normal');
  const [storedStyle, setStoredStyle] = useLocalStorage<WritingStyle>(
    'selectedWritingStyle',
    'Normal'
  );
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  // Effect for client-side only hydration
  useEffect(() => {
    // This will only run on the client after hydration
    if (typeof window !== 'undefined') {
      console.log('Hydrating style from localStorage:', storedStyle);
      setSelectedStyleState(storedStyle);
    }
  }, [storedStyle]);

  // Combined setter for both state and localStorage 
  const setSelectedStyle = useCallback((style: WritingStyle) => {
    console.log('Setting style to:', style);
    setSelectedStyleState(style);
    setStoredStyle(style);
  }, [setStoredStyle]);

  // Handle style selection without losing textarea focus
  const handleStyleSelect = useCallback((style: WritingStyle) => {
    console.log(`Setting style to: ${style}`);
    // Ensure style is set synchronously
    setSelectedStyle(style);
    setStyleDropdownOpen(false);
    
    // Return focus to textarea if needed, but don't scroll to it
    if (textareaRef.current && input.length > 0) {
      const currentPos = textareaRef.current.selectionStart;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(currentPos, currentPos);
    }
  }, [setSelectedStyle, input, textareaRef]);

  // Function to capture current style and submit the form
  const submitWithCurrentStyle = useCallback(() => {
    const currentStyle = selectedStyle;
    console.log(`Direct submit with current style: ${currentStyle}`);
    
    // Create user message
    const userMessage: CreateMessage = {
      role: 'user',
      content: input,
    };
    
    // Debug: Log complete message details
    console.log('Submitting message with details:', {
      content: input,
      style: currentStyle,
      hasAttachments: attachments.length > 0,
      isSearchEnabled: isSearchActive
    });
    
    // Submit with current style value and search state
    append(userMessage, {
      experimental_attachments: attachments,
      body: {
        selectedWritingStyle: currentStyle,
        useSearchGrounding: isSearchActive
      },
    });
    
    setAttachments([]);
    setInput('');
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [input, selectedStyle, attachments, append, setAttachments, setInput, setLocalStorageInput, width, textareaRef, isSearchActive, resetHeight]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Add warning when using attachments with Anthropic
    if (attachments.length > 0) {
      const warningMessage = "Note: Image attachments may not work correctly with the current AI provider. If you encounter errors, try sending your message without attachments.";
      console.warn(warningMessage);
    }
    
    // Use the direct submission function to capture current style
    submitWithCurrentStyle();
    
  }, [chatId, attachments, submitWithCurrentStyle]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(false);
  }, []);
  
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    
    setUploadQueue(files.map((file) => file.name));
    
    const uploadPromises = files.map((file) => uploadFile(file));
    Promise.all(uploadPromises)
      .then((uploadedAttachments) => {
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );
        
        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      })
      .catch((error) => {
        console.error('Error uploading dropped files!', error);
      })
      .finally(() => {
        setUploadQueue([]);
      });
  }, [setAttachments, uploadFile]);

  const handleRemoveAttachment = useCallback((attachmentUrl: string) => {
    setAttachments(currentAttachments => 
      currentAttachments.filter(attachment => attachment.url !== attachmentUrl)
    );
  }, [setAttachments]);

  // Add state for voice modal
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  
  // Handle opening the voice modal
  const handleOpenVoiceModal = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    console.log('Voice button clicked, opening modal...');
    
    // Open the modal immediately - permissions will be checked inside the modal
    setIsVoiceModalOpen(true);
  }, []);
  
  // Add handler for voice input
  const handleVoiceInput = (text: string) => {
    setInput(text);
    
    // Auto-resize textarea after setting input
    // if (textareaRef.current) {
    //   adjustHeight();
    // }
  };

  const toggleSearch = useCallback(() => {
    setIsSearchActive(!isSearchActive);
  }, [isSearchActive]);

  return (
    <div
      className={cx(
        className,
        'sticky bottom-0 bg-background px-3 @container/input w-full flex flex-col gap-2',
      )}
    >
      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 mb-[-20px] overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment 
              key={attachment.url} 
              attachment={attachment} 
              onRemove={() => handleRemoveAttachment(attachment.url)}
            />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}
      <div className="relative">
        <Textarea
          data-testid="multimodal-input"
          ref={textareaRef}
          placeholder="Ask anything"
          value={input}
          onChange={handleInput}
          className={cx(
            'min-h-[115px] w-full p-5 pb-16 max-h-[calc(75dvh)] mt-3 mb-3 overflow-hidden resize-none rounded-[20px] !text-sm border bg-background dark:bg-[#1A1A1A]'
          )}
          rows={2}
          autoFocus
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();

              if (status !== 'ready') {
                toast.error('Please wait for the model to finish its response!');
              } else {
                submitWithCurrentStyle();
              }
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />

        <div className="absolute bottom-0 p-[19px] py-6 w-fit flex flex-row justify-start gap-2">
          <AttachmentsButton fileInputRef={fileInputRef} status={status} />
          <ClientOnly>
            <div className="relative" ref={styleDropdownRef}>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className={cx(
                  "rounded-full px-2.5 py-1.5 h-fit border dark:border-[#232323] transition-colors duration-200 flex items-center gap-1.5",
                  selectedStyle === 'Normal' 
                    ? 'bg-transparent hover:bg-transparent/5 dark:hover:bg-[#232323]'
                    : [
                        'bg-gradient-to-l via-muted/5',
                        selectedStyle === 'Concise' && 'from-blue-100/30 dark:from-blue-900/10 hover:from-blue-100/40 hover:dark:bg-[#232323]',
                        selectedStyle === 'Explanatory' && 'from-amber-100/30 dark:from-amber-900/10 hover:from-amber-100/40 hover:dark:bg-[#232323]',
                        selectedStyle === 'Formal' && 'from-purple-100/30 dark:from-purple-900/10 hover:from-purple-100/40 hover:dark:bg-[#232323]',
                    ]
                )}
                onClick={(event) => {
                  event.preventDefault();
                  setStyleDropdownOpen(!styleDropdownOpen);
                }}
                disabled={status !== 'ready'}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className={cx(
                    selectedStyle !== 'Normal' && [
                      styleColorMap[selectedStyle].text,
                      styleColorMap[selectedStyle].darkText
                    ]
                  )}
                >
                  <path d="M9 3V21M9 3L3 9M9 3L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 3H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M15 9H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M3 15H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M3 21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className={cx(
                  "text-sm font-normal",
                  selectedStyle !== 'Normal' && [
                    styleColorMap[selectedStyle].text,
                    styleColorMap[selectedStyle].darkText
                  ]
                )}>{selectedStyle}</span>
              </Button>
              
              {styleDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-[#191919] rounded-md z-10 py-1 border dark:border-[#303030] w-[120px]">
                  {Object.keys(writingStylePrompts).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={cx(
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-[#272727]",
                        selectedStyle === style && "bg-gray-100 dark:bg-[#272727]",
                        selectedStyle === style && style !== 'Normal' && [
                          styleColorMap[style as WritingStyle].text,
                          styleColorMap[style as WritingStyle].darkText
                        ]
                      )}
                      onClick={() => handleStyleSelect(style as WritingStyle)}
                    >
                      {style}
                      {selectedStyle === style && (
                        <span className={cx(
                          "float-right",
                          style !== 'Normal' ? [
                            styleColorMap[style as WritingStyle].text,
                            styleColorMap[style as WritingStyle].darkText
                          ] : "text-blue-500"
                        )}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ClientOnly>
        </div>

        <div className="absolute bottom-0 right-0 px-[19px] py-[22px] w-fit flex flex-row justify-end gap-2">
          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <ClientOnly>
              <SendButton
                input={input}
                submitForm={submitWithCurrentStyle}
                uploadQueue={uploadQueue}
                selectedStyle={selectedStyle}
              />
            </ClientOnly>
          )}
        </div>
      </div>
      
      {/* Add Voice Modal */}
      {/* <VoiceModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
        onVoiceInput={handleVoiceInput}
      /> */}
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className={cx(
        "rounded-full p-[8px] h-fit border dark:border-[#232323] transition-colors duration-200",
        "bg-transparent hover:bg-transparent/5 dark:hover:bg-[#232323]"
      )}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={20} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-[8px] h-fit border dark:border-[#232323] hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={20} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  input,
  submitForm,
  uploadQueue,
  selectedStyle,
}: {
  input: string;
  submitForm: () => void;
  uploadQueue: Array<string>;
  selectedStyle: WritingStyle;
}) {
  useEffect(() => {
    console.log('SendButton initialized with style:', selectedStyle);
  }, [selectedStyle]);

  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-[8px] h-fit border dark:border-[#232323] hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        console.log(`Sending with style: ${selectedStyle}`);
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={20} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.selectedStyle !== nextProps.selectedStyle) return false;
  return true;
});
