import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI SDK
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Create a buffer from the audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert to base64 for inline data
    const base64Audio = buffer.toString('base64');

    try {
      // Initialize the Gemini client
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      
      // Use gemini-1.5-pro for audio processing
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-pro'
      });
      
      // Set generation configuration
      const generationConfig = {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      };

      // Create properly formatted content structure for Gemini API
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: "I'm speaking to you through audio. Please transcribe what I said and respond as a helpful AI assistant."
            },
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: base64Audio
              }
            }
          ]
        }
      ];

      // Generate content with the audio
      const result = await model.generateContent({
        contents: contents
      });
      
      const response = await result.response;
      const responseText = response.text();
      
      // Try to extract what the user said from the response
      // This is a simple heuristic - actual implementation might need more sophistication
      let userTranscript = "Audio processed successfully";
      
      // Look for common patterns in the AI's response that might contain the transcription
      const transcriptMatch = responseText.match(/(?:you said|I heard|transcript):\s*["']?(.*?)["']?(?:\.|$)/i);
      if (transcriptMatch && transcriptMatch[1]) {
        userTranscript = transcriptMatch[1].trim();
      }

      return NextResponse.json({
        transcript: userTranscript,
        response: {
          text: responseText,
          isFinished: true
        }
      });
    } catch (error: any) {
      console.error('Error communicating with Gemini API:', error);
      
      // Provide more detailed error message if available
      const errorMessage = error.message || 'Error communicating with Gemini API';
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    
    const errorMessage = error.message || 'Error processing request';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 