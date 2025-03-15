'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

// Use require instead of import to avoid TypeScript errors
// @ts-ignore
const { GoogleGenerativeAI } = require('@google/generative-ai');

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceInput: (text: string) => void;
}

export function VoiceModal({ isOpen, onClose, onVoiceInput }: VoiceModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser compatibility when the component mounts
  useEffect(() => {
    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaRecorder or getUserMedia not supported in this browser');
      setBrowserSupported(false);
    } else {
      setBrowserSupported(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRecordingTime(0);
      setProcessingAudio(false);
    } else {
      stopRecording();
      
      // Ensure all audio resources are cleaned up
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.error('Error stopping media tracks:', e);
        }
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Cleanup on unmount
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.error('Error stopping media tracks on unmount:', e);
        }
      }
    };
  }, [isOpen]);

  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      setShowPermissionHelp(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      setShowPermissionHelp(false);
      
      // Try to use a more compatible audio format
      const mimeType = getSupportedMimeType();
      console.log(`Using audio format: ${mimeType}`);
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        setProcessingAudio(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          // Convert the audio blob to base64
          const audioBase64 = await blobToBase64(audioBlob);
          
          // Process the audio with Google's API
          const transcription = await processAudioWithGoogleAPI(audioBase64, mimeType);
          
          if (transcription && transcription.trim().length > 0) {
            toast.success('Voice successfully transcribed!');
            onVoiceInput(transcription);
          } else {
            toast.warning('No text was detected in your speech. Please try again.');
          }
          onClose();
        } catch (error) {
          console.error('Error processing voice input:', error);
          toast.error('Failed to process voice input');
        } finally {
          setProcessingAudio(false);
          // Clean up the stream tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      
      // Provide more specific error messages based on the error
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
          console.log('Permission denied: The user has blocked microphone access');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          toast.error('No microphone found. Please check your microphone connection.');
          console.log('No microphone found: The device might not have a microphone or it\'s disconnected');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          toast.error('Cannot access microphone. It might be in use by another application.');
          console.log('Hardware error: The microphone might be in use by another application');
        } else if (error.name === 'SecurityError') {
          toast.error('Security error accessing microphone. This site might need HTTPS.');
          console.log('Security error: Microphone access might require secure context (HTTPS)');
        } else {
          toast.error(`Microphone error: ${error.name}`);
          console.log(`Other microphone error: ${error.name} - ${error.message}`);
        }
      } else {
        toast.error('Could not access microphone. Please check your browser settings and try again.');
      }
    }
  };

  // Get a supported MIME type for audio recording
  const getSupportedMimeType = () => {
    const possibleTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg'
    ];
    
    for (const type of possibleTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Default fallback
    return 'audio/webm';
  };

  // Helper function to convert Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Function to process audio with Google's Multimodal API
  const processAudioWithGoogleAPI = async (audioBase64: string, mimeType: string) => {
    try {
      // Check if API key is available
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        toast.error('Google API key is not configured');
        return "Error: API key is not configured. Please check your environment variables.";
      }

      console.log('Initializing Google Generative AI...');
      // Initialize the Gemini API
      const genAI = new GoogleGenerativeAI(apiKey);
      
      console.log('Using model: gemini-1.5-flash');
      // Get the model - use gemini-1.5-flash for better multimodal support
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      console.log(`Preparing audio content (${mimeType})...`);
      // Create audio content part
      const audioContent = {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      };
      
      console.log('Sending request to Google API...');
      // Generate content from audio
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [audioContent] }],
      });
      
      console.log('Received response from Google API');
      // Return the transcription
      const text = result.response.text();
      console.log('Transcription:', text);
      return text;
    } catch (error) {
      console.error('Error calling Google Multimodal API:', error);
      let errorMessage = "Failed to process audio with Google API";
      
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        console.error('Error details:', error.stack);
      }
      
      toast.error(errorMessage);
      return "Sorry, I couldn't transcribe your audio. Please try again.";
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 max-w-md w-full mx-4"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Prevent Enter key from submitting forms
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
      >
        <div className="flex flex-col items-center justify-center">
          {/* Show browser not supported message */}
          {!browserSupported && (
            <div className="mb-4 text-center bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 font-bold mb-2">
                Browser Not Supported
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                Your browser doesn't support voice recording. Please try using a modern browser like Chrome, Firefox, Edge, or Safari.
              </p>
              <Button 
                variant="outline" 
                onClick={(event) => {
                  event.preventDefault();
                  onClose();
                }}
                className="mt-4 px-6"
                type="button"
              >
                Close
              </Button>
            </div>
          )}

          {/* Show permission help if needed */}
          {browserSupported && showPermissionHelp && (
            <div className="mb-4 text-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                <strong>Microphone Permission Required</strong>
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                Your browser should show a permission prompt to access your microphone.
                Please click "Allow" to enable voice recording.
              </p>
              <div className="flex flex-col space-y-2 mt-2">
                <div className="text-xs text-left text-gray-700 dark:text-gray-300">
                  <strong>If you don't see a prompt:</strong>
                  <ul className="list-disc list-inside mt-1 pl-2">
                    <li>Check the URL/address bar for permission icons</li>
                    <li>Make sure your microphone is connected</li>
                    <li>No other apps are using your microphone</li>
                    <li>Try refreshing the page</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        
          {/* Only show recording UI if browser is supported */}
          {browserSupported && (
            <>
              {/* Blue circle with animation when recording */}
              <div className={`relative rounded-full bg-blue-100 dark:bg-blue-900/30 w-24 h-24 flex items-center justify-center mb-6 ${
                isRecording ? 'animate-pulse' : processingAudio ? 'animate-spin' : ''
              }`}>
                <div className="rounded-full bg-blue-500 w-16 h-16 flex items-center justify-center">
                  {processingAudio ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" x2="12" y1="19" y2="22"></line>
                    </svg>
                  )}
                </div>
              </div>
              
              {/* Status text */}
              <p className="text-lg font-medium mb-2">
                {processingAudio 
                  ? 'Processing audio with Gemini...' 
                  : isRecording 
                    ? 'Listening...' 
                    : 'Click to start speaking'}
              </p>
              
              {/* Timer when recording */}
              {isRecording && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {formatTime(recordingTime)}
                </p>
              )}
              
              {/* Control buttons */}
              <div className="flex gap-4 mt-4">
                <Button 
                  variant="outline" 
                  onClick={(event) => {
                    event.preventDefault();
                    onClose();
                  }}
                  className="px-6"
                  disabled={processingAudio}
                  type="button"
                >
                  Cancel
                </Button>
                
                <Button 
                  variant={isRecording ? "destructive" : "default"}
                  onClick={(event) => {
                    event.preventDefault();
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  className="px-6"
                  disabled={processingAudio}
                  type="button"
                >
                  {isRecording ? 'Stop' : 'Start'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 