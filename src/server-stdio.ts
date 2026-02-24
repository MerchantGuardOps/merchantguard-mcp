import { MerchantGuardMCPServer } from "./merchantguard-mcp-server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./utils/logger.js";

async function main() {
  const server = new MerchantGuardMCPServer({
    name: "merchantguard-mcp",
    version: "1.0.0",
    apiUrl: process.env.MERCHANTGUARD_API_URL || "https://api.merchantguard.ai/v1",
    apiKey: process.env.MERCHANTGUARD_API_KEY || "demo",
    highRiskThreshold: parseInt(process.env.GUARDSCORE_HIGH_RISK_THRESHOLD || "30", 10),
    mediumRiskThreshold: parseInt(process.env.GUARDSCORE_MEDIUM_RISK_THRESHOLD || "60", 10),
    autoDeclineThreshold: parseInt(process.env.GUARDSCORE_AUTO_DECLINE_THRESHOLD || "15", 10),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MerchantGuard MCP Server running on stdio");
}

main().catch((error) => {
  logger.error(`Server failed to start: ${error}`);
  process.exit(1);
});
