import { LLMProvider, ToolDefinition, ToolCall } from './types';

// Stub — swap LLM_PROVIDER=claude in .env to activate once Anthropic SDK is installed.
export class ClaudeProvider implements LLMProvider {
  async runWithTools(
    _systemPrompt: string,
    _userMessage: string,
    _tools: ToolDefinition[],
    _toolHandler: (call: ToolCall) => Promise<unknown>,
  ): Promise<string> {
    throw new Error('ClaudeProvider is not implemented yet. Set LLM_PROVIDER=gemini.');
  }
}
