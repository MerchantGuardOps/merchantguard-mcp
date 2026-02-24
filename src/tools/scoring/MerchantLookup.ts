import { GuardScoreAPI } from "../../api/guardscore.js";
import { MCPTool } from "../mcp-tool.js";
import { merchantLookupSchema } from "../../schemas/schemas.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { successResult, errorResult } from "../../utils/mcp-response.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class MerchantLookup extends MCPTool {
  constructor(api: GuardScoreAPI) {
    super(
      api,
      "guardscore_merchant_lookup",
      "GuardScore Merchant Lookup",
      "Look up a merchant's GuardScore, verification status, chargeback rate, and VAMP standing. Search by merchant ID, business name, or website URL. Use this to assess merchant trustworthiness before engaging in commerce.",
      merchantLookupSchema.shape,
    );
  }

  async execute(args: z.infer<typeof merchantLookupSchema>): Promise<CallToolResult> {
    try {
      if (!args.merchant_id && !args.merchant_name && !args.website) {
        return errorResult("At least one of merchant_id, merchant_name, or website is required");
      }
      const result = await this.api.lookupMerchant(args);
      return successResult(result);
    } catch (error) {
      logger.error(`Merchant lookup error: ${(error as Error).message}`);
      return errorResult(`Lookup failed: ${(error as Error).message}`);
    }
  }
}
