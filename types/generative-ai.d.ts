declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    
    getGenerativeModel(options: { model: string }): GenerativeModel;
  }

  export interface GenerativeModel {
    generateContent(params: {
      contents: Array<{
        role: string;
        parts: Array<{
          inlineData?: {
            data: string;
            mimeType: string;
          };
          text?: string;
          [key: string]: any;
        }>;
      }>;
    }): Promise<GenerateContentResponse>;
  }

  export interface GenerateContentResponse {
    response: {
      text: () => string;
    };
  }
} 