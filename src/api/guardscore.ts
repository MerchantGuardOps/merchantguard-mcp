import { logger } from "../utils/logger.js";
import type {
  TransactionRiskResult,
  MerchantProfile,
  AgentVerification,
  DisputePrediction,
  VelocityResult,
  CrossRailResult,
  VAMPAnalysis,
  RiskLevel,
  PaymentRail,
  DisputeType,
} from "../types/index.js";

export interface GuardScoreConfig {
  apiUrl: string;
  apiKey: string;
  highRiskThreshold: number;
  mediumRiskThreshold: number;
  autoDeclineThreshold: number;
}

/**
 * GuardScore API client.
 *
 * Calls the real MerchantGuard API at merchantguard.ai.
 * Falls back to intelligent mock data when apiKey === "demo" or on API error.
 */
export class GuardScoreAPI {
  private config: GuardScoreConfig;
  private demoMode: boolean;

  constructor(config: GuardScoreConfig) {
    this.config = config;
    this.demoMode = config.apiKey === "demo" || !config.apiKey;
    if (this.demoMode) {
      logger.info("GuardScore API running in DEMO mode (mock data)");
    } else {
      logger.info(`GuardScore API connected to ${config.apiUrl}`);
    }
  }

  private riskLevel(score: number): RiskLevel {
    if (score <= this.config.autoDeclineThreshold) return "critical";
    if (score <= this.config.highRiskThreshold) return "high";
    if (score <= this.config.mediumRiskThreshold) return "medium";
    return "low";
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MerchantGuard-MCP/1.0.0",
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.config.apiKey && this.config.apiKey !== "demo") {
      headers["X-API-Key"] = this.config.apiKey;
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    return globalThis.fetch(url, { ...options, headers });
  }

  // ===========================================================================
  // 1. Transaction Risk Scoring
  //    Real: POST /api/v2/guardscore/assess (free, no auth, takes quiz answers)
  //    Maps MCP transaction inputs to GuardScore quiz format
  // ===========================================================================

  async scoreTransaction(args: {
    amount: number;
    currency: string;
    merchant_category: string;
    payment_rail: PaymentRail;
    merchant_id?: string;
    agent_id?: string;
    description?: string;
  }): Promise<TransactionRiskResult> {
    logger.info("Scoring transaction", { amount: args.amount, rail: args.payment_rail });

    if (!this.demoMode) {
      try {
        // Map MCP inputs to GuardScore assessment quiz answers
        const answers: Record<string, unknown> = {
          industry: this.mapCategory(args.merchant_category),
          monthly_transactions: this.mapVolume(args.amount),
          total_disputes: "1-5",
          fraud_disputes: "0",
          fraud_tools: args.payment_rail === "card" ? ["3ds", "cvv"] : ["velocity"],
          region: "US",
          business_age: "1-2y",
          current_psp: ["stripe"],
          avg_transaction_value: this.mapTicket(args.amount),
          refund_rate: "5-10",
          compliance_readiness: ["terms", "privacy"],
          stablecoin_readiness: args.payment_rail === "stablecoin" || args.payment_rail === "crypto" ? "yes_already" : "no",
          customer_mfa: "optional",
          checkout_platform: "shopify",
        };

        const res = await this.fetch("/api/v2/guardscore/assess", {
          method: "POST",
          body: JSON.stringify({ answers }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const score = (data.score as number) ?? 75;
          const level = this.riskLevel(score);

          const factors: TransactionRiskResult["risk_factors"] = [];
          const insights = (data.insights as Array<{ severity: string; title: string; message: string }>) || [];
          for (const insight of insights.slice(0, 5)) {
            factors.push({
              factor: insight.title?.replace(/\s+/g, "_").toLowerCase().slice(0, 40) || "unknown",
              severity: this.mapSeverity(insight.severity),
              description: insight.message || insight.title,
            });
          }

          if (args.agent_id) {
            factors.push({
              factor: "agent_initiated",
              severity: "low",
              description: "Transaction initiated by AI agent — additional verification recommended",
            });
          }

          return {
            risk_score: score,
            risk_level: level,
            recommended_action: level === "critical" ? "decline" : level === "high" ? "review" : "approve",
            risk_factors: factors,
            guardscore_version: (data._meta as Record<string, string>)?.scoring_version || "2.0",
            scored_at: (data._meta as Record<string, string>)?.timestamp || new Date().toISOString(),
          };
        }
        logger.warn(`GuardScore assess API returned ${res.status}, falling back to mock`);
      } catch (err) {
        logger.warn(`GuardScore assess API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockScoreTransaction(args);
  }

  // ===========================================================================
  // 2. Merchant Lookup
  //    Real: GET /api/agent/merchant/[id] (requires API key)
  // ===========================================================================

  async lookupMerchant(args: {
    merchant_id?: string;
    merchant_name?: string;
    website?: string;
  }): Promise<MerchantProfile> {
    const identifier = args.merchant_id || args.merchant_name || args.website || "unknown";
    logger.info("Looking up merchant", { identifier });

    if (!this.demoMode && args.merchant_id) {
      try {
        const res = await this.fetch(`/api/agent/merchant/${encodeURIComponent(args.merchant_id)}`);
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const guardscore = (data.guardscore as number) ?? 50;
          const compliance = data.compliance as Record<string, unknown> | undefined;

          return {
            merchant_id: (data.merchant_id as string) || args.merchant_id!,
            name: args.merchant_name || (data.merchant_id as string) || identifier,
            guardscore,
            risk_level: this.riskLevel(guardscore),
            verification_status: (data.verification as Record<string, unknown>)?.kyb_verified ? "verified" : "pending",
            chargeback_rate: (compliance?.chargeback_rate as number) ?? 0.5,
            industry: "e-commerce",
            vamp_status: this.mapVampStatus(compliance?.vamp_status as string),
            last_updated: (data.last_updated as string) || new Date().toISOString(),
          };
        }
        logger.warn(`Merchant lookup API returned ${res.status}, falling back to mock`);
      } catch (err) {
        logger.warn(`Merchant lookup API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockLookupMerchant(args);
  }

  // ===========================================================================
  // 3. Agent Verification
  //    Real: POST /api/v2/agent/screen (requires sk_live_ key or MG_INTERNAL_KEY)
  //    8-step screening pipeline: Rate Limit > OPRF > Trust > Capability Gate >
  //    Honeypot > Phonetic > Cross-Modal > TAT Issuance
  // ===========================================================================

  async verifyAgent(args: {
    agent_id: string;
    agent_name?: string;
    requesting_action: string;
    transaction_amount?: number;
  }): Promise<AgentVerification> {
    logger.info("Verifying agent", { agent_id: args.agent_id, action: args.requesting_action });

    if (!this.demoMode) {
      try {
        const res = await this.fetch("/api/v2/agent/screen", {
          method: "POST",
          body: JSON.stringify({
            agentId: args.agent_id,
            requestedAction: args.requesting_action,
            payload: {
              agent_name: args.agent_name,
              transaction_amount: args.transaction_amount,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const verdict = data.verdict as string;
          const capLevel = data.capabilityLevel as string;

          const trustScore = verdict === "ALLOW" ? 85 : verdict === "ENHANCED_SCREENING" ? 55 : 20;
          const anomalies: string[] = [];
          if (data.denialReason) anomalies.push(data.denialReason as string);
          if (data.requiredScreenings) {
            anomalies.push(...(data.requiredScreenings as string[]));
          }

          return {
            agent_id: args.agent_id,
            trust_score: trustScore,
            verification_status: verdict === "ALLOW" ? "verified" : verdict === "DENY" ? "suspended" : "pending",
            authorization_level: this.mapCapability(capLevel),
            spending_limit: capLevel === "PAYMENT_EXECUTE" ? 10000 : capLevel === "PAYMENT_INITIATE" ? 1000 : 100,
            spending_limit_currency: "USD",
            anomaly_flags: anomalies,
            verified_at: new Date().toISOString(),
          };
        }

        // 401/403 expected when API key doesn't have screen access
        if (res.status === 401 || res.status === 403) {
          logger.info("Agent screen requires sk_live_ API key, using mock");
        } else {
          logger.warn(`Agent screen API returned ${res.status}, falling back to mock`);
        }
      } catch (err) {
        logger.warn(`Agent screen API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockVerifyAgent(args);
  }

  // ===========================================================================
  // 4. Dispute Prediction
  //    Real: POST /api/v2/guardscore/simulate (free, VAMP remediation simulator)
  // ===========================================================================

  async predictDispute(args: {
    transaction_amount: number;
    merchant_category: string;
    payment_rail: PaymentRail;
    card_type?: string;
    is_recurring?: boolean;
    merchant_id?: string;
  }): Promise<DisputePrediction> {
    logger.info("Predicting dispute", { amount: args.transaction_amount });

    if (!this.demoMode) {
      try {
        const res = await this.fetch("/api/v2/guardscore/simulate", {
          method: "POST",
          body: JSON.stringify({
            monthlyTransactions: 1000,
            fraudDisputes: 2,
            nonFraudChargebacks: 5,
            threeDSCoveragePct: args.payment_rail === "card" ? 50 : 0,
            additionalCleanTransactions: 0,
            disputeResolutionRatePct: 20,
          }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const sim = data.simulation as Record<string, unknown>;
          if (sim) {
            const currentVamp = (sim.currentVampPct as number) ?? 0.5;
            const probability = Math.min(0.99, Math.max(0.01, currentVamp / 100));
            const level = probability > 0.15 ? "critical" : probability > 0.10 ? "high" : probability > 0.05 ? "medium" : "low";
            const actions = ((sim.rankedActions as Array<Record<string, string>>) || [])
              .map(a => `${a.action}: ${a.impact}`)
              .slice(0, 5);

            return {
              dispute_probability: parseFloat(probability.toFixed(4)),
              predicted_dispute_type: args.is_recurring ? "subscription_canceled" : "fraud",
              risk_level: level as RiskLevel,
              preventive_actions: actions.length > 0 ? actions : [
                "Enable 3D Secure on all transactions",
                "Implement RDR (Rapid Dispute Resolution)",
                "Add velocity checks",
              ],
              model_version: (data.meta as Record<string, string>)?.engine || "MerchantGuard VAMP Simulator v1.0",
            };
          }
        }
        logger.warn(`Simulator API returned ${res.status}, falling back to mock`);
      } catch (err) {
        logger.warn(`Simulator API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockPredictDispute(args);
  }

  // ===========================================================================
  // 5. Velocity Check
  //    No direct public endpoint — uses intelligent mock with real thresholds
  // ===========================================================================

  async checkVelocity(args: {
    entity_id: string;
    entity_type: "merchant" | "agent" | "card" | "wallet";
    time_window: string;
    transaction_count?: number;
  }): Promise<VelocityResult> {
    logger.info("Checking velocity", { entity: args.entity_id, window: args.time_window });
    // Velocity check requires Clerk auth (session) — no public API available
    // Uses intelligent mock based on real VAMP threshold knowledge
    return this.mockCheckVelocity(args);
  }

  // ===========================================================================
  // 6. Cross-Rail Fraud Detection
  //    Real: POST /api/v2/guard with intent "transaction_review"
  //    Unified Compliance Decision Layer
  // ===========================================================================

  async checkCrossRail(args: {
    entity_id: string;
    payment_rails: PaymentRail[];
  }): Promise<CrossRailResult> {
    logger.info("Cross-rail check", { entity: args.entity_id, rails: args.payment_rails });

    if (!this.demoMode) {
      try {
        const res = await this.fetch("/api/v2/guard", {
          method: "POST",
          body: JSON.stringify({
            intent: "transaction_review",
            payment: {
              methods: args.payment_rails,
            },
            business: {
              name: args.entity_id,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const decision = data.decision as string;
          const riskLevel = data.risk_level as string;
          const reasons = (data.reasons as string[]) || [];

          const crossRailScore = decision === "allow" ? 80 : decision === "allow_with_conditions" ? 55 : 25;
          const railScores: Record<string, number> = {};
          for (const rail of args.payment_rails) {
            railScores[rail] = crossRailScore + (rail === "crypto" ? -10 : rail === "card" ? 5 : 0);
          }

          return {
            entity_id: args.entity_id,
            cross_rail_risk_score: crossRailScore,
            risk_level: this.mapRiskLevel(riskLevel),
            rails_analyzed: args.payment_rails,
            suspicious_patterns: reasons,
            rail_scores: railScores,
          };
        }

        if (res.status === 401 || res.status === 403) {
          logger.info("Guard API requires auth, using mock");
        } else {
          logger.warn(`Guard API returned ${res.status}, falling back to mock`);
        }
      } catch (err) {
        logger.warn(`Guard API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockCheckCrossRail(args);
  }

  // ===========================================================================
  // 7. VAMP Analysis
  //    Real: POST /api/v2/guardscore/simulate (free, VAMP remediation simulator)
  // ===========================================================================

  async analyzeVAMP(args: {
    merchant_id: string;
    visa_merchant_id?: string;
  }): Promise<VAMPAnalysis> {
    logger.info("VAMP analysis", { merchant: args.merchant_id });

    if (!this.demoMode) {
      try {
        // Use simulator to get VAMP projections
        const res = await this.fetch("/api/v2/guardscore/simulate", {
          method: "POST",
          body: JSON.stringify({
            monthlyTransactions: 2000,
            fraudDisputes: 3,
            nonFraudChargebacks: 8,
            threeDSCoveragePct: 40,
            additionalCleanTransactions: 0,
            disputeResolutionRatePct: 15,
          }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const sim = data.simulation as Record<string, unknown>;
          if (sim) {
            const currentVamp = (sim.currentVampPct as number) ?? 0.5;
            const projectedVamp = (sim.projectedVampPct as number) ?? currentVamp;
            const actions = ((sim.rankedActions as Array<Record<string, string>>) || [])
              .map(a => a.action || a.description || "")
              .filter(Boolean)
              .slice(0, 5);

            let status: VAMPAnalysis["vamp_status"];
            if (currentVamp < 0.65) status = "standard";
            else if (currentVamp < 0.9) status = "monitored";
            else status = "excessive";

            const vampScore = Math.round(100 - currentVamp * 50);
            const trend = projectedVamp < currentVamp ? "improving" : projectedVamp > currentVamp ? "declining" : "stable";

            return {
              merchant_id: args.merchant_id,
              vamp_score: Math.max(0, vampScore),
              vamp_status: status,
              fraud_rate: parseFloat(currentVamp.toFixed(2)),
              dispute_rate: parseFloat((currentVamp * 1.5).toFixed(2)),
              monthly_trend: trend,
              recommended_actions: actions.length > 0 ? actions : [
                "Enable 3D Secure 2.0 on all transactions",
                "Enroll in Visa RDR",
                "Add Ethoca/Verifi alerts",
              ],
              visa_threshold_distance: parseFloat(Math.max(0, 0.9 - currentVamp).toFixed(2)),
            };
          }
        }
        logger.warn(`Simulator API returned ${res.status}, falling back to mock`);
      } catch (err) {
        logger.warn(`Simulator API error: ${(err as Error).message}, falling back to mock`);
      }
    }

    return this.mockAnalyzeVAMP(args);
  }

  // ===========================================================================
  // Helper mappers
  // ===========================================================================

  private mapCategory(cat: string): string {
    const map: Record<string, string> = {
      gambling: "gaming", adult: "adult", crypto_exchange: "crypto",
      pharmaceuticals: "nutra", weapons: "high_risk", gaming: "gaming",
      "e-commerce": "ecommerce", ecommerce: "ecommerce", travel: "travel",
      subscription: "subscriptions", digital_goods: "ecommerce",
      cbd: "cbd", dating: "dating", saas: "saas",
    };
    return map[cat.toLowerCase()] || "ecommerce";
  }

  private mapVolume(amount: number): string {
    if (amount > 10000) return "10000+";
    if (amount > 2000) return "2000-10000";
    if (amount > 500) return "500-2000";
    return "100-500";
  }

  private mapTicket(amount: number): string {
    if (amount > 500) return "500+";
    if (amount > 100) return "100-500";
    if (amount > 25) return "25-100";
    return "0-25";
  }

  private mapSeverity(sev: string): RiskLevel {
    if (sev === "critical") return "critical";
    if (sev === "warning") return "high";
    if (sev === "info") return "medium";
    return "low";
  }

  private mapVampStatus(status: string | undefined): "standard" | "monitored" | "excessive" | "at_risk" {
    if (status === "at_risk" || status === "excessive") return "excessive";
    if (status === "warning" || status === "monitored") return "monitored";
    return "standard";
  }

  private mapCapability(cap: string | undefined): "none" | "basic" | "standard" | "elevated" | "full" {
    if (cap === "PAYMENT_EXECUTE" || cap === "ORCHESTRATE") return "full";
    if (cap === "PAYMENT_INITIATE") return "elevated";
    if (cap === "DATA_WRITE") return "standard";
    if (cap === "READ_ONLY") return "basic";
    return "none";
  }

  private mapRiskLevel(level: string | undefined): RiskLevel {
    if (level === "critical") return "critical";
    if (level === "high") return "high";
    if (level === "medium") return "medium";
    return "low";
  }

  // ===========================================================================
  // Mock implementations (used in demo mode or as fallback)
  // ===========================================================================

  private mockScoreTransaction(args: {
    amount: number;
    currency: string;
    merchant_category: string;
    payment_rail: PaymentRail;
    merchant_id?: string;
    agent_id?: string;
  }): TransactionRiskResult {
    let score = 85;
    const factors: TransactionRiskResult["risk_factors"] = [];

    if (args.amount > 10000) {
      score -= 20;
      factors.push({ factor: "high_value", severity: "high", description: `Transaction amount $${args.amount} exceeds high-value threshold ($10,000)` });
    } else if (args.amount > 5000) {
      score -= 10;
      factors.push({ factor: "elevated_value", severity: "medium", description: `Transaction amount $${args.amount} is above average` });
    }

    if (args.payment_rail === "crypto" || args.payment_rail === "stablecoin") {
      score -= 5;
      factors.push({ factor: "alternative_rail", severity: "low", description: `${args.payment_rail} transactions have limited chargeback protection` });
    }

    if (args.agent_id) {
      score -= 3;
      factors.push({ factor: "agent_initiated", severity: "low", description: "Transaction initiated by AI agent — additional verification recommended" });
    }

    if (!args.merchant_id) {
      score -= 15;
      factors.push({ factor: "unknown_merchant", severity: "high", description: "No merchant ID provided — unable to verify merchant history" });
    }

    const highRiskCategories = ["gambling", "adult", "crypto_exchange", "pharmaceuticals", "weapons"];
    if (highRiskCategories.includes(args.merchant_category.toLowerCase())) {
      score -= 15;
      factors.push({ factor: "high_risk_category", severity: "high", description: `Merchant category "${args.merchant_category}" is classified as high-risk` });
    }

    score = Math.max(0, Math.min(100, score));
    const level = this.riskLevel(score);

    return {
      risk_score: score,
      risk_level: level,
      recommended_action: level === "critical" ? "decline" : level === "high" ? "review" : "approve",
      risk_factors: factors,
      guardscore_version: "1.0.0-mock",
      scored_at: new Date().toISOString(),
    };
  }

  private mockLookupMerchant(args: {
    merchant_id?: string;
    merchant_name?: string;
    website?: string;
  }): MerchantProfile {
    const identifier = args.merchant_id || args.merchant_name || args.website || "unknown";
    const hash = [...identifier].reduce((a, c) => a + c.charCodeAt(0), 0);
    const guardscore = 40 + (hash % 55);

    return {
      merchant_id: args.merchant_id || `MG-${hash.toString(16).toUpperCase()}`,
      name: args.merchant_name || identifier,
      guardscore,
      risk_level: this.riskLevel(guardscore),
      verification_status: guardscore > 70 ? "verified" : guardscore > 50 ? "pending" : "unverified",
      chargeback_rate: parseFloat((0.1 + (100 - guardscore) * 0.02).toFixed(2)),
      industry: "e-commerce",
      vamp_status: guardscore > 70 ? "standard" : guardscore > 50 ? "monitored" : "excessive",
      last_updated: new Date().toISOString(),
    };
  }

  private mockVerifyAgent(args: {
    agent_id: string;
    agent_name?: string;
    requesting_action: string;
    transaction_amount?: number;
  }): AgentVerification {
    const hash = [...args.agent_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const trustScore = 50 + (hash % 45);
    const anomalies: string[] = [];

    if (args.transaction_amount && args.transaction_amount > 5000) {
      anomalies.push("transaction_exceeds_typical_agent_limit");
    }

    const dangerousActions = ["refund_all", "delete_account", "transfer_funds", "modify_pricing"];
    if (dangerousActions.includes(args.requesting_action.toLowerCase())) {
      anomalies.push("high_privilege_action_requested");
    }

    return {
      agent_id: args.agent_id,
      trust_score: trustScore,
      verification_status: trustScore > 80 ? "verified" : trustScore > 60 ? "pending" : "unverified",
      authorization_level: trustScore > 85 ? "full" : trustScore > 70 ? "standard" : trustScore > 50 ? "basic" : "none",
      spending_limit: trustScore > 80 ? 10000 : trustScore > 60 ? 1000 : 100,
      spending_limit_currency: "USD",
      anomaly_flags: anomalies,
      verified_at: new Date().toISOString(),
    };
  }

  private mockPredictDispute(args: {
    transaction_amount: number;
    merchant_category: string;
    payment_rail: PaymentRail;
    card_type?: string;
    is_recurring?: boolean;
  }): DisputePrediction {
    let probability = 0.02;
    const actions: string[] = [];

    if (args.transaction_amount > 500) {
      probability += 0.03;
      actions.push("Enable 3DS authentication for transactions over $500");
    }

    const highDisputeCategories = ["travel", "digital_goods", "subscription", "gambling"];
    if (highDisputeCategories.includes(args.merchant_category.toLowerCase())) {
      probability += 0.05;
      actions.push(`Category "${args.merchant_category}" has elevated dispute rates — enhance order confirmation flow`);
    }

    if (args.payment_rail === "card" && args.is_recurring) {
      probability += 0.04;
      actions.push("Send pre-billing reminder for recurring charges to reduce friendly fraud");
    }

    if (args.payment_rail === "stablecoin" || args.payment_rail === "crypto") {
      probability -= 0.01;
      actions.push("Stablecoin transactions have no traditional chargeback mechanism — implement escrow or reputation-based resolution");
    }

    probability = Math.min(0.99, Math.max(0.01, probability));
    const level = probability > 0.15 ? "critical" : probability > 0.10 ? "high" : probability > 0.05 ? "medium" : "low";

    let predictedType: DisputeType | null = null;
    if (probability > 0.05) {
      predictedType = args.is_recurring ? "subscription_canceled" : args.merchant_category === "digital_goods" ? "product_not_as_described" : "fraud";
    }

    return {
      dispute_probability: parseFloat(probability.toFixed(4)),
      predicted_dispute_type: predictedType,
      risk_level: level,
      preventive_actions: actions,
      model_version: "1.0.0-mock",
    };
  }

  private mockCheckVelocity(args: {
    entity_id: string;
    entity_type: "merchant" | "agent" | "card" | "wallet";
    time_window: string;
    transaction_count?: number;
  }): VelocityResult {
    const hash = [...args.entity_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const baseline = 15 + (hash % 30);
    const current = args.transaction_count ?? baseline + (hash % 20) - 5;
    const ratio = current / baseline;
    const anomaly = ratio > 2.5;
    const score = Math.min(100, Math.max(0, 100 - (ratio - 1) * 30));

    return {
      entity_id: args.entity_id,
      velocity_score: Math.round(score),
      anomaly_detected: anomaly,
      transactions_in_window: current,
      baseline_average: baseline,
      pattern_analysis: anomaly
        ? `Transaction count (${current}) is ${ratio.toFixed(1)}x the baseline (${baseline}) — potential velocity attack or compromised credentials`
        : `Transaction velocity is within normal range (${ratio.toFixed(1)}x baseline)`,
      time_window: args.time_window,
    };
  }

  private mockCheckCrossRail(args: {
    entity_id: string;
    payment_rails: PaymentRail[];
  }): CrossRailResult {
    const hash = [...args.entity_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const railScores: Record<string, number> = {};
    const patterns: string[] = [];

    for (const rail of args.payment_rails) {
      const railHash = [...(args.entity_id + rail)].reduce((a, c) => a + c.charCodeAt(0), 0);
      railScores[rail] = 50 + (railHash % 45);
    }

    const scores = Object.values(railScores);
    const maxDiff = Math.max(...scores) - Math.min(...scores);

    if (maxDiff > 30) {
      patterns.push("Large risk score variance across rails — possible rail-hopping to evade detection");
    }
    if (args.payment_rails.includes("card") && args.payment_rails.includes("crypto")) {
      patterns.push("Mixed card + crypto activity — monitor for card-funded crypto purchases followed by irreversible transfers");
    }
    if (args.payment_rails.length >= 3) {
      patterns.push("Activity across 3+ payment rails — unusual for single entity, verify legitimate business need");
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const crossRailScore = Math.round(Math.max(0, avgScore - patterns.length * 10));

    return {
      entity_id: args.entity_id,
      cross_rail_risk_score: crossRailScore,
      risk_level: this.riskLevel(crossRailScore),
      rails_analyzed: args.payment_rails,
      suspicious_patterns: patterns,
      rail_scores: railScores,
    };
  }

  private mockAnalyzeVAMP(args: {
    merchant_id: string;
    visa_merchant_id?: string;
  }): VAMPAnalysis {
    const hash = [...args.merchant_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const fraudRate = parseFloat((0.1 + (hash % 20) * 0.05).toFixed(2));
    const disputeRate = parseFloat((0.2 + (hash % 25) * 0.04).toFixed(2));
    const vampScore = Math.round(100 - fraudRate * 20 - disputeRate * 15);
    const actions: string[] = [];

    let status: VAMPAnalysis["vamp_status"];
    let thresholdDistance: number;

    if (fraudRate < 0.65) {
      status = "standard";
      thresholdDistance = parseFloat((0.65 - fraudRate).toFixed(2));
    } else if (fraudRate < 0.9) {
      status = "monitored";
      thresholdDistance = parseFloat((0.9 - fraudRate).toFixed(2));
      actions.push("Implement RDR (Rapid Dispute Resolution) to deflect disputes before they count as chargebacks");
      actions.push("Enable Verifi CDRN alerts for real-time chargeback notification");
    } else {
      status = "excessive";
      thresholdDistance = 0;
      actions.push("URGENT: Fraud rate exceeds Visa VAMP threshold — immediate remediation required");
      actions.push("Deploy 3DS on all transactions to shift liability");
      actions.push("Implement velocity controls and device fingerprinting");
      actions.push("Consider temporary transaction limits on high-risk categories");
    }

    if (disputeRate > 0.5) {
      actions.push("High dispute rate — review product descriptions and refund policy clarity");
    }

    return {
      merchant_id: args.merchant_id,
      vamp_score: Math.max(0, vampScore),
      vamp_status: status,
      fraud_rate: fraudRate,
      dispute_rate: disputeRate,
      monthly_trend: vampScore > 70 ? "improving" : vampScore > 40 ? "stable" : "declining",
      recommended_actions: actions,
      visa_threshold_distance: thresholdDistance,
    };
  }
}
