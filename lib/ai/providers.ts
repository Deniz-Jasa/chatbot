import { 
  customProvider 
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env["GITHUB_TOKEN"],
});

export const myProvider = customProvider({
  languageModels: {
    'claude-3-5': anthropic('claude-3-5-haiku-latest'),
    'claude-3-7': anthropic('claude-3-7-sonnet-latest'),
    'gemini-2-5-pro-exp': google('gemini-2.5-pro-exp-03-25', { useSearchGrounding: true }),
    'gemini-2-0-flash': google('gemini-2.0-flash-001', { useSearchGrounding: true }),
    'cohere-command-a': cohere('command-a-03-2025'),
    'title-model': google('gemini-2.0-flash-001'),
    'artifact-model': anthropic('claude-3-5-haiku-latest'),
    'gpt-4o': openai('gpt-4o'),
    'deepseek-r1': openai('DeepSeek-R1')
  },
});