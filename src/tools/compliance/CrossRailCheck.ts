import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { crossRailCheckSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class CrossRailCheck extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_cross_rail_check",
      "GuardScore Cross-Rail Fraud Detection",
      "Analyze an entity's activity across multiple payment rails (card, stablecoin, crypto, ACH, wire) to detect cross-rail fraud patterns. Identifies rail-hopping, fragmented identity exploitation, and arbitrage attacks that single-rail fraud systems miss. This is critical during the card-to-stablecoin transition period where fraudsters exploit the gaps between rail-specific fraud tools. Requires at least 2 payment rails.",
      crossRailCheckSchema.shape,
    );
  }

  async execute(args: z.infer<typeof crossRailCheckSchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.checkCrossRail(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Cross-rail check error: ${(error as Error).message}`);
      return errorResult(`Cross-rail check failed: ${(error as Error).message}`);
    }
  }
}
