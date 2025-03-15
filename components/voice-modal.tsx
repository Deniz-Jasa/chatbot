'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { MicIcon, SquareIcon } from 'lucide-react';

// Define types for the Gemini API response
type GeminiResponse = {
  text: string;
  isFinished: boolean;
};

interface VoiceModalProps {
  textAreaValue: string;
  setTextAreaValue: (value: string) => void;
  className?: string;
}

export function VoiceModal({ textAreaValue, setTextAreaValue, className }: VoiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<GeminiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Initialize media recorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setTranscript('');
      setResponse(null);
      setError(null);
      setIsOpen(true);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to use this feature.');
      console.error('Error accessing microphone:', err);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // Stop all tracks of the stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setIsProcessing(true);
    }
  };
  
  // Process audio and send to Gemini API
  const processAudio = async (audioBlob: Blob) => {
    try {
      // Create FormData to send audio to the server
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      setTranscript('Processing your audio...');
      
      // Send audio to our API endpoint
      const response = await fetch('/api/gemini-voice', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }
      
      const data = await response.json();
      const transcribedText = data.transcript || 'Audio processed successfully';
      setTranscript(transcribedText);
      
      // Update the text area with the transcribed text
      if (transcribedText && transcribedText !== 'Audio processed successfully') {
        setTextAreaValue(textAreaValue ? `${textAreaValue} ${transcribedText}` : transcribedText);
      }
      
      setResponse(data.response);
      
      if (data.response && data.response.text) {
        speakResponse(data.response.text);
      }
      
      setIsProcessing(false);
      
      // Auto close dialog after successful processing
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      setError('Error processing audio. Please try again.');
      console.error('Error processing audio:', err);
      setIsProcessing(false);
    }
  };
  
  // Use speech synthesis to speak the response
  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Set a voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer a female voice if available
        const femaleVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('female'));
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
      }
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };
  
  // Clean up speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);
  
  return (
    <>
      <Button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        variant="ghost"
        size="icon"
        className={cn(
          isRecording && "text-red-500 animate-pulse",
          isProcessing && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={isProcessing}
        aria-label={isRecording ? "Stop recording" : "Start voice input"}
      >
        {isRecording ? <SquareIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
      </Button>
      
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <Dialog.Title className="text-lg font-semibold">Voice Input</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {isRecording 
                ? "I'm listening... Click stop when you're done speaking." 
                : isProcessing
                  ? "Processing your audio..."
                  : "Click the microphone to start speaking."}
            </Dialog.Description>
            
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                className={cn(
                  "rounded-full h-16 w-16", 
                  isRecording && "animate-pulse",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
                disabled={isProcessing}
              >
                {isRecording ? <SquareIcon className="h-6 w-6" /> : <MicIcon className="h-6 w-6" />}
              </Button>
              
              {error && (
                <div className="text-sm text-destructive font-medium">{error}</div>
              )}
              
              {transcript && transcript !== 'Processing your audio...' && (
                <div className="w-full">
                  <h3 className="text-sm font-medium mb-1">You said:</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm">{transcript}</div>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button variant="outline">Close</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
