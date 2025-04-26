export const DEFAULT_CHAT_MODEL: string = 'gemini-2-0-pro-exp';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: ChatModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT 4o',
    description: 'Chat model for daily use'
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    description: 'Great for advanced reasoning'
  },
  {
    id: 'gemini-2-5-pro-exp',
    name: 'Gemini 2.5 Pro',
    description: 'Powerful for complex queries'
  },
  {
    id: 'gemini-2-0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast for simple tasks'
  },
  {
    id: 'claude-3-5',
    name: 'Claude 3.5 Haiku',
    description: 'Great model for coding'
  },
  {
    id: 'claude-3-7',
    name: 'Claude 3.7 Sonnet',
    description: 'Improved model for coding'
  },
  {
    id: 'cohere-command-a',
    name: 'Cohere Command-A',
    description: 'Excels in RAG and knowledge retrieval'
  }
];
