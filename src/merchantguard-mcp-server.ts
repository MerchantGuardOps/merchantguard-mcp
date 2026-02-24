import { GuardScoreAPI, GuardScoreConfig } from "./api/guardscore.js";
import { TransactionRiskScore } from "./tools/scoring/TransactionRiskScore.js";
import { MerchantLookup } from "./tools/scoring/MerchantLookup.js";
import { AgentVerify } from "./tools/scoring/AgentVerify.js";
import { DisputePredict } from "./tools/monitoring/DisputePredict.js";
import { VelocityCheck } from "./tools/monitoring/VelocityCheck.js";
import { CrossRailCheck } from "./tools/compliance/CrossRailCheck.js";
import { VAMPAnalysis } from "./tools/compliance/VAMPAnalysis.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Tool } from "./tools/mcp-tool.js";

export interface MerchantGuardMCPConfig {
  name: string;
  version: string;
  apiUrl: string;
  apiKey: string;
  highRiskThreshold?: number;
  mediumRiskThreshold?: number;
  autoDeclineThreshold?: number;
}

export class MerchantGuardMCPServer extends McpServer {
  private readonly guardscoreApi: GuardScoreAPI;

  constructor(config: MerchantGuardMCPConfig) {
    super({ name: config.name, version: config.version });

    const apiConfig: GuardScoreConfig = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      highRiskThreshold: config.highRiskThreshold ?? 30,
      mediumRiskThreshold: config.mediumRiskThreshold ?? 60,
      autoDeclineThreshold: config.autoDeclineThreshold ?? 15,
    };

    this.guardscoreApi = new GuardScoreAPI(apiConfig);
    this.registerTools();
  }

  private registerTools() {
    const tools: Tool[] = [
      // Scoring — use before processing payments
      new TransactionRiskScore(this.guardscoreApi),
      new MerchantLookup(this.guardscoreApi),
      new AgentVerify(this.guardscoreApi),

      // Monitoring — use during/after transactions
      new DisputePredict(this.guardscoreApi),
      new VelocityCheck(this.guardscoreApi),

      // Compliance — cross-rail and network monitoring
      new CrossRailCheck(this.guardscoreApi),
      new VAMPAnalysis(this.guardscoreApi),
    ];

    for (const tool of tools) {
      this.tool(
        tool.getName(),
        tool.getDefinition().description ?? "",
        tool.getDefinition().inputSchema ?? {},
        async (args: Record<string, unknown>) => tool.execute(args),
      );
    }
  }
}
