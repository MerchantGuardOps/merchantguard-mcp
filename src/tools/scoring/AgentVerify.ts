import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { agentVerifySchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class AgentVerify extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_agent_verify",
      "GuardScore Agent Verification",
      "Verify an AI agent's trustworthiness and authorization level before allowing it to transact. Returns trust score, spending limits, authorization level, and anomaly flags. Essential for agent-to-agent commerce and autonomous purchasing. This is the '3DS for AI agents' — use it whenever a non-human entity initiates a financial action.",
      agentVerifySchema.shape,
    );
  }

  async execute(args: z.infer<typeof agentVerifySchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.verifyAgent(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Agent verification error: ${(error as Error).message}`);
      return errorResult(`Verification failed: ${(error as Error).message}`);
    }
  }
}
