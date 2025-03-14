export const DEFAULT_CHAT_MODEL: string = 'gemini-2-0-pro-exp';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    "id": "gemini-1-5-flash",
    "name": "Gemini 1.5 Flash",
    "description": "High-speed chat model for quick tasks."
  },
  {
    "id": "gemini-2-0-pro-exp",
    "name": "Gemini 2.0 Pro",
    "description": "Google's newest and most advanced multimodal model (Feb 2024)"
  },
  {
    "id": "claude-3-5",
    "name": "Claude 3.5 Haiku",
    "description": "Fast and efficient Claude model for everyday use"
  },
  {
    "id": "claude-3-7",
    "name": "Claude 3.7 Sonnet",
    "description": "Latest Claude model with enhanced reasoning and coding abilities"
  },
  {
    "id": "cohere-command-r",
    "name": "Cohere Command-R",
    "description": "Optimized for advanced RAG and comprehensive knowledge tasks."
  }
];
