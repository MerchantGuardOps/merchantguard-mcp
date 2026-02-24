import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function successResult(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text" as const, text }],
    isError: false,
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
