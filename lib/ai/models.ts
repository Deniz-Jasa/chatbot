export const DEFAULT_CHAT_MODEL: string = 'gemini-2-0-pro-exp';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    "id": "gemini-2-0-flash",
    "name": "Gemini 2.0 Flash",
    "description": "High-speed chat model for quick tasks"
  },
  {
    "id": "gemini-2-5-pro-exp",
    "name": "Gemini 2.5 Pro",
    "description": "Advanced chat model for complex tasks"
  },
  {
    "id": "gpt-4o",
    "name": "ChatGPT 4o",
    "description": "Multi-model chat model for everyday tasks"
  },
  {
    "id": "gpt-4.1",
    "name": "ChatGPT 4.1",
    "description": "Chat model for that excels in coding."
  },
  {
    "id": "gpt-o4-mini",
    "name": "ChatGPT o4-mini",
    "description": "Reasoning model for that excels in coding."
  },
  {
    "id": "gpt-o3",
    "name": "ChatGPT o3",
    "description": "Multi-model chat model for everyday tasks"
  },
  {
    "id": "mistral-large",
    "name": "Mistral Large",
    "description": "Powerful model for coding, research, and more!"
  },
  {
    "id": "claude-3-5",
    "name": "Claude 3.5 Haiku",
    "description": "Fast and efficient Claude model for everyday use"
  },
  {
    "id": "claude-3-7",
    "name": "Claude 3.7 Sonnet",
    "description": "Latest Claude model with enhanced reasoning and coding"
  },
  {
    "id": "cohere-command-a",
    "name": "Cohere Command-A",
    "description": "Optimized for advanced RAG and comprehensive knowledge tasks"
  }
];
