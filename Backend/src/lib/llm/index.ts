import { LLMProvider } from './types';
import { GeminiProvider } from './gemini.provider';
import { ClaudeProvider } from './claude.provider';

export type { LLMProvider, ToolDefinition, ToolCall } from './types';

export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'gemini';
  if (provider === 'claude') return new ClaudeProvider();
  return new GeminiProvider();
}
