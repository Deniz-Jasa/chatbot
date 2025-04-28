'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from './markdown';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isActive && isLoading) {
      // Start the timer
      intervalId = setInterval(() => {
        setDuration(prev => prev + 100); // Update every 100ms
      }, 100);
    }

    // Clean up interval
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, isLoading]);

  // Stop timer when loading is done
  useEffect(() => {
    if (!isLoading && isActive) {
      setIsActive(false);
    }
  }, [isLoading, isActive]);

  const variants = {
    collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
    expanded: { height: 'auto', opacity: 1, overflow: 'visible' },
  };

  const formattedDuration = `${(duration / 1000).toFixed(1)}s`;

  return (
    <div className="mt-[-8px]">
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs pr-4 border border-[#323232]"
            disabled
          >
            <span>Reasoning...</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs pr-4 border border-[#323232]"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="message-reasoning-toggle"
          >
            <div
              className={cn('transition-transform', {
                'rotate-180': isExpanded,
              })}
            >
              <ChevronDownIcon size={14} />
            </div>
            <div className="flex items-center">
              <span>{isExpanded ? "Hide" : "Show"} reasoning</span>
              {(isActive || duration > 0) && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({formattedDuration})
                </span>
              )}
            </div>
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            style={{ overflow: 'hidden' }}
            className="pl-4 text-[10.5pt] text-zinc-600 dark:text-[#9C9C9C] border-l border-[#323232] flex flex-col gap-4 my-2"
          >
            <Markdown>{reasoning}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
