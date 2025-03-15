'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { VoiceModal } from '@/components/voice-modal';
import { Button } from '@/components/ui/button';
import { PaperclipIcon, SendIcon } from 'lucide-react';

export function MessageInput() {
  const [message, setMessage] = useState('');
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-2">
      <Textarea
        value={message}
        onChange={handleChange}
        placeholder="Type a message..."
        rows={3}
        className="resize-none mb-2 focus-visible:ring-0 border-0 focus-visible:ring-offset-0 p-3"
      />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Attachment button */}
          <Button type="button" variant="ghost" size="icon" aria-label="Attach file">
            <PaperclipIcon className="h-4 w-4" />
          </Button>
          
          {/* Voice input button - positioned next to attachment button */}
          <VoiceModal 
            textAreaValue={message} 
            setTextAreaValue={setMessage} 
          />
        </div>
        
        <Button 
          type="submit" 
          size="sm" 
          disabled={!message.trim()}
        >
          <SendIcon className="h-4 w-4 mr-2" />
          Send
        </Button>
      </div>
    </form>
  );
} 