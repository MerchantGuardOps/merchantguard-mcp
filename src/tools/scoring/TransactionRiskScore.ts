import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { transactionRiskSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class TransactionRiskScore extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_transaction_risk",
      "GuardScore Transaction Risk",
      "Score a transaction for fraud risk before processing payment. Returns a 0-100 GuardScore (higher = safer), risk level, recommended action (approve/review/decline), and specific risk factors. Use this BEFORE calling any payment tool (Worldpay, Stripe, etc.) to screen transactions. Supports card, stablecoin, crypto, ACH, and wire transactions.",
      transactionRiskSchema.shape,
    );
  }

  async execute(args: z.infer<typeof transactionRiskSchema>): Promise<CallToolResult> {
    try {
      const result = await this.api.scoreTransaction(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Transaction scoring error: ${(error as Error).message}`);
      return errorResult(`Scoring failed: ${(error as Error).message}`);
    }
  }
}
