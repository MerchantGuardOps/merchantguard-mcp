# MerchantGuard MCP Server

**AI-native fraud scoring and risk intelligence for agentic commerce.**

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that provides real-time fraud detection, risk scoring, and compliance tools for AI agents processing payments. Works alongside any payment MCP server (Worldpay, Stripe, Coinbase, etc.) as the security and trust layer.

## Why MerchantGuard MCP?

As AI agents begin transacting autonomously ([200M+ agent orders on Alibaba](https://corporate.worldpay.com/news-releases/news-release-details/worldpay-accelerates-future-agentic-commerce-model-context), [DoorDash building agentic commerce](https://www.doordash.com/), [Stripe confirming stablecoins as core infrastructure](https://stripe.com/)), the payment industry faces a critical gap: **existing fraud tools only work within their own rail**.

Visa's fraud detection only scores Visa transactions. Stripe Radar only works on Stripe. But agents will use multiple rails simultaneously — cards, stablecoins, crypto, ACH. Who scores across all of them?

**MerchantGuard MCP is the cross-rail security layer for the agentic economy.**

```
AI Agent
  -> MerchantGuard MCP (risk scoring)  <-- YOU ARE HERE
    -> Worldpay MCP / Stripe MCP / Coinbase (payment processing)
```

## Tools

| Tool | Category | Description |
|------|----------|-------------|
| `guardscore_transaction_risk` | Scoring | Score any transaction for fraud risk (0-100) before payment. Supports card, stablecoin, crypto, ACH, wire. |
| `guardscore_merchant_lookup` | Scoring | Look up a merchant's GuardScore, verification status, chargeback rate, and VAMP standing. |
| `guardscore_agent_verify` | Scoring | Privacy-preserving agent verification via OPRF (RFC 9497). Agents prove trustworthiness without exposing internals. The "3DS for AI agents." |
| `guardscore_dispute_predict` | Monitoring | Predict chargeback probability and recommended preventive actions. |
| `guardscore_velocity_check` | Monitoring | Detect anomalous transaction velocity for merchants, agents, cards, or wallets. |
| `guardscore_cross_rail_check` | Compliance | Analyze activity across multiple payment rails to detect cross-rail fraud. |
| `guardscore_vamp_analysis` | Compliance | Analyze Visa VAMP status with threshold distances and remediation actions. |

## Quick Start

### Using npm

```bash
npm install
npm run build
npm start
```

### Using Docker

```bash
docker build -t merchantguard/mcp .
docker run -p 3002:3002 --env-file .env merchantguard/mcp
```

### Using stdio (for Claude Desktop, Cursor, etc.)

```bash
npm run start:stdio
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `MERCHANTGUARD_API_URL` | `https://api.merchantguard.ai/v1` | MerchantGuard API endpoint |
| `MERCHANTGUARD_API_KEY` | `demo` | API key (demo mode works without a key) |
| `PORT` | `3002` | HTTP server port |
| `GUARDSCORE_HIGH_RISK_THRESHOLD` | `30` | Score below this = high risk |
| `GUARDSCORE_MEDIUM_RISK_THRESHOLD` | `60` | Score below this = medium risk |
| `GUARDSCORE_AUTO_DECLINE_THRESHOLD` | `15` | Score below this = auto-decline |

## Integration Examples

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "merchantguard": {
      "command": "node",
      "args": ["/path/to/merchantguard-mcp/dist/server-stdio.js"],
      "env": {
        "MERCHANTGUARD_API_KEY": "your_key_here"
      }
    }
  }
}
```

### With Worldpay MCP (Side-by-Side)

An AI agent connects to both servers. Before processing any payment through Worldpay, it first scores the transaction through MerchantGuard:

```json
{
  "mcpServers": {
    "merchantguard": {
      "command": "node",
      "args": ["/path/to/merchantguard-mcp/dist/server-stdio.js"]
    },
    "worldpay": {
      "command": "node",
      "args": ["/path/to/worldpay-mcp/dist/server-stdio.js"]
    }
  }
}
```

**Agent workflow:**
1. Call `guardscore_transaction_risk` to score the transaction
2. If approved, call `guardscore_merchant_lookup` to verify the merchant
3. If the agent is autonomous, call `guardscore_agent_verify` to confirm authorization
4. Process payment via Worldpay's `take_guest_payment`
5. Call `guardscore_dispute_predict` to assess post-transaction risk

### With OpenAI Agentic Commerce Protocol (ACP)

MerchantGuard MCP can serve as the risk assessment layer in ACP flows:

```
Buyer Agent -> ACP Checkout -> MerchantGuard (risk check) -> Payment Provider -> Merchant
```

## Architecture

```
src/
  api/
    guardscore.ts          # GuardScore API client
  tools/
    mcp-tool.ts            # Base tool interface
    scoring/
      TransactionRiskScore.ts   # Pre-payment risk scoring
      MerchantLookup.ts         # Merchant intelligence
      AgentVerify.ts            # AI agent verification
    monitoring/
      DisputePredict.ts         # Chargeback prediction
      VelocityCheck.ts          # Velocity anomaly detection
    compliance/
      CrossRailCheck.ts         # Cross-rail fraud detection
      VAMPAnalysis.ts           # Visa VAMP compliance
  schemas/
    schemas.ts             # Zod validation schemas
  types/
    index.ts               # TypeScript type definitions
  utils/
    logger.ts              # Logging
    mcp-response.ts        # MCP response helpers
  merchantguard-mcp-server.ts  # Main server class
  server-http.ts               # HTTP transport entry point
  server-stdio.ts              # stdio transport entry point
```

## About MerchantGuard

[MerchantGuard](https://merchantguard.ai) is the privacy-preserving fraud scoring platform for high-risk and agentic commerce. Our patented cross-rail fraud detection technology scores transactions across card networks, stablecoins, and crypto — providing unified risk intelligence that rail-specific tools can't match.

**Patent Portfolio:** Cross-Lingual BFT Paradox scoring, Multi-Agent AI Security, and GuardScore risk engine.

**Member:** [Agentic AI Foundation (AAIF)](https://aaif.io) by the Linux Foundation.

**Privacy-Preserving Architecture:** OPRF behavioral fingerprinting (RFC 9497), soulbound agent credentials, zero-knowledge trust verification. Agents prove compliance without exposing internals.

## License

MIT
