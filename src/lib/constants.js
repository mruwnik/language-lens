// LLM Provider Configuration
export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OPENWEBUI: 'openwebui',
  GOOGLE: 'google'
};

export const DEFAULT_PROVIDER = LLM_PROVIDERS.OPENAI;

// Default model configurations per provider
export const DEFAULT_MODELS = {
  [LLM_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [LLM_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [LLM_PROVIDERS.OPENWEBUI]: 'default',
  [LLM_PROVIDERS.GOOGLE]: 'gemini-pro'
};

// Available models per provider
export const AVAILABLE_MODELS = {
  [LLM_PROVIDERS.OPENAI]: [
    'gpt-4o-mini',
    'gpt-3.5-turbo',
  ],
  [LLM_PROVIDERS.ANTHROPIC]: [
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  [LLM_PROVIDERS.OPENWEBUI]: [
    'default'  // This will be populated dynamically from the server
  ],
  [LLM_PROVIDERS.GOOGLE]: [
    'gemini-pro'
  ]
}; 