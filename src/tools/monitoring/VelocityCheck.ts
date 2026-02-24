import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { velocityCheckSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class VelocityCheck extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_velocity_check",
      "GuardScore Velocity Check",
      "Check transaction velocity for a merchant, AI agent, card, or wallet address to detect anomalous patterns. Compares current activity against historical baselines to identify velocity attacks, compromised credentials, or rogue agent behavior. Returns velocity score, anomaly flag, and pattern analysis.",
      velocityCheckSchema.shape,
    );
  }

  async execute(args: z.infer<typeof velocityCheckSchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.checkVelocity(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Velocity check error: ${(error as Error).message}`);
      return errorResult(`Velocity check failed: ${(error as Error).message}`);
    }
  }
}
