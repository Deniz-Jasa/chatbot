import { useEffect, useRef, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const previousMessagesLengthRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;
    
    if (container && end) {
      // Function to smooth scroll to bottom
      const smoothScrollToBottom = () => {
        end.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end'
        });
      };
      
      // Check if user has scrolled away from bottom
      const isUserScrolledUp = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Threshold of 100px from bottom
        return scrollHeight - scrollTop - clientHeight > 100;
      };

      // Track message count to detect new messages
      const checkForNewMessages = () => {
        // Get current message elements
        const messageElements = container.querySelectorAll('[data-message]');
        const currentLength = messageElements.length;
        
        // If we have more messages than before, it's a new message
        if (currentLength > previousMessagesLengthRef.current) {
          // Only auto-scroll if user is already near the bottom
          if (!isUserScrolledUp()) {
            // Small delay for smoother experience
            setTimeout(smoothScrollToBottom, 100);
          }
          previousMessagesLengthRef.current = currentLength;
        }
      };

      // Observer to detect content changes
      const observer = new MutationObserver(() => {
        checkForNewMessages();
      });
      
      observer.observe(container, {
        childList: true,
        subtree: true,
      });
      
      // Initial scroll for when the component first loads
      setTimeout(() => {
        end.scrollIntoView({ behavior: 'auto' });
      }, 100);
      
      return () => observer.disconnect();
    }
  }, []);
  
  return [containerRef, endRef];
}
