export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LLMProvider {
  runWithTools(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    toolHandler: (call: ToolCall) => Promise<unknown>,
  ): Promise<string>;
}
