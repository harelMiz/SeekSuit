import {
  GoogleGenerativeAI,
  FunctionDeclaration,
  SchemaType,
  Tool,
} from '@google/generative-ai';
import { LLMProvider, ToolDefinition, ToolCall } from './types';

// Converts our generic JSON Schema tool definitions to Gemini's FunctionDeclaration format.
function toGeminiFunctions(tools: ToolDefinition[]): Tool {
  const declarations: FunctionDeclaration[] = tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: (t.parameters as any).properties ?? {},
      required: (t.parameters as any).required ?? [],
    },
  }));
  return { functionDeclarations: declarations };
}

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(key);
  }

  async runWithTools(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    toolHandler: (call: ToolCall) => Promise<unknown>,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      tools: tools.length > 0 ? [toGeminiFunctions(tools)] : undefined,
    });

    const chat = model.startChat();
    let response = await chat.sendMessage(userMessage);

    // Agentic loop: keep calling tools until Gemini stops requesting them
    while (true) {
      const candidate = response.response.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];

      const fnCalls = parts.filter(p => p.functionCall);
      if (fnCalls.length === 0) break;

      const toolResults = await Promise.all(
        fnCalls.map(async part => {
          const fn = part.functionCall!;
          const result = await toolHandler({ name: fn.name, args: (fn.args as Record<string, unknown>) ?? {} });
          return {
            functionResponse: {
              name: fn.name,
              response: { result },
            },
          };
        }),
      );

      response = await chat.sendMessage(toolResults);
    }

    return response.response.text();
  }
}
