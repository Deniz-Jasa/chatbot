import {
  customProvider
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { createTogetherAI } from '@ai-sdk/togetherai';

const togetherai = createTogetherAI({
  apiKey: process.env.TOGETHER_AI_API_KEY ?? '',
});

export const myProvider = customProvider({
  languageModels: {
    'claude-3-5': anthropic('claude-3-5-haiku-latest'),
    'claude-3-7': anthropic('claude-3-7-sonnet-latest'),
    'gemini-2-5-pro-exp': google('gemini-2.5-pro-exp-03-25', { useSearchGrounding: true }),
    'gemini-2-0-flash': google('gemini-2.0-flash-001', { useSearchGrounding: true }),
    'cohere-command-a': cohere('command-a-03-2025'),
    
    // Deep Seek R1 via Together AI
    'deepseek-r1': togetherai('deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free') as any,

    'title-model': google('gemini-1.5-flash-latest'),
    'artifact-model': google('gemini-1.5-flash-latest'),
  },
});