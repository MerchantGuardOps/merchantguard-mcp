import { GuardScoreAPI } from "../api/guardscore.js";
import { ZodRawShape } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolDefinition {
  title?: string;
  description?: string;
  inputSchema?: ZodRawShape;
  outputSchema?: ZodRawShape;
  annotations?: {
    [x: string]: unknown;
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface Tool {
  getName(): string;
  getDefinition(): ToolDefinition;
  execute(args: unknown): Promise<CallToolResult>;
}

export abstract class MCPTool implements Tool {
  protected name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: ZodRawShape;
  protected api: GuardScoreAPI;

  protected constructor(
    api: GuardScoreAPI,
    name: string,
    title: string,
    description: string,
    inputSchema: ZodRawShape,
  ) {
    this.api = api;
    this.name = name;
    this.title = title;
    this.description = description;
    this.inputSchema = inputSchema;
  }

  getName(): string {
    return this.name;
  }

  getDefinition(): ToolDefinition {
    return {
      title: this.title,
      description: this.description,
      inputSchema: this.inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    };
  }

  abstract execute(args: unknown): Promise<CallToolResult>;
}
