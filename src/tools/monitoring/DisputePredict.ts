import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { disputePredictSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class DisputePredict extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_dispute_predict",
      "GuardScore Dispute Prediction",
      "Predict the probability of a chargeback or dispute for a given transaction. Returns dispute probability (0-1), predicted dispute type (fraud, product_not_received, subscription_canceled, etc.), and specific preventive actions to reduce risk. Use this for transactions in high-dispute categories or above-average amounts.",
      disputePredictSchema.shape,
    );
  }

  async execute(args: z.infer<typeof disputePredictSchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.predictDispute(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Dispute prediction error: ${(error as Error).message}`);
      return errorResult(`Prediction failed: ${(error as Error).message}`);
    }
  }
}
