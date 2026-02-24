import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { vampAnalysisSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class VAMPAnalysis extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_vamp_analysis",
      "GuardScore VAMP Analysis",
      "Analyze a merchant's Visa Acquirer Monitoring Program (VAMP) status and risk. Returns current VAMP score, fraud and dispute rates, distance to Visa thresholds, monthly trend, and specific remediation actions. Essential for merchants processing Visa transactions to stay below monitoring thresholds and avoid penalties or termination.",
      vampAnalysisSchema.shape,
    );
  }

  async execute(args: z.infer<typeof vampAnalysisSchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.analyzeVAMP(args);
      return successResult(result);
    } catch (error) {
      logger.error(`VAMP analysis error: ${(error as Error).message}`);
      return errorResult(`VAMP analysis failed: ${(error as Error).message}`);
    }
  }
}
