import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export const myProvider = customProvider({
  languageModels: {
    // Anthropic Claude models
    'claude-3-5': anthropic('claude-3-5-haiku-latest'),
    'claude-3-7': anthropic('claude-3-7-sonnet-latest'),
    
    // Google Gemini models
    'gemini-2-0-pro-exp': google('gemini-2.0-pro-pro-exp-02-05'),
    'gemini-1-5-flash': google('gemini-1.5-flash-latest'),
    
    // Cohere models
    'cohere-command-r': cohere('command-r'),
    
    // OpenRouter models
    'deepseek-r1': openrouter.languageModel('deepseek/deepseek-chat'),
    
    // Service models
    'title-model': google('gemini-1.5-flash-latest'),
    'artifact-model': google('gemini-1.5-flash-latest'),
  },
});
