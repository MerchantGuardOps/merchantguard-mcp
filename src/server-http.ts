import { MerchantGuardMCPServer } from "./merchantguard-mcp-server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { logger } from "./utils/logger.js";
import { randomUUID } from "node:crypto";

const PORT = parseInt(process.env.PORT || "3002", 10);

const app = express();
app.use(express.json());

const server = new MerchantGuardMCPServer({
  name: "merchantguard-mcp",
  version: "1.0.0",
  apiUrl: process.env.MERCHANTGUARD_API_URL || "https://api.merchantguard.ai/v1",
  apiKey: process.env.MERCHANTGUARD_API_KEY || "demo",
  highRiskThreshold: parseInt(process.env.GUARDSCORE_HIGH_RISK_THRESHOLD || "30", 10),
  mediumRiskThreshold: parseInt(process.env.GUARDSCORE_MEDIUM_RISK_THRESHOLD || "60", 10),
  autoDeclineThreshold: parseInt(process.env.GUARDSCORE_AUTO_DECLINE_THRESHOLD || "15", 10),
});

// Streamable HTTP transport (MCP 2025 standard)
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "merchantguard-mcp",
    version: "1.0.0",
    tools: 7,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`MerchantGuard MCP Server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
