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
 * Currently returns intelligent mock data for demonstration and development.
 * When the MerchantGuard API is production-ready, swap mock methods for real
 * HTTP calls — the interface stays the same.
 */
export class GuardScoreAPI {
  private config: GuardScoreConfig;

  constructor(config: GuardScoreConfig) {
    this.config = config;
  }

  private riskLevel(score: number): RiskLevel {
    if (score <= this.config.autoDeclineThreshold) return "critical";
    if (score <= this.config.highRiskThreshold) return "high";
    if (score <= this.config.mediumRiskThreshold) return "medium";
    return "low";
  }

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

    // Risk scoring logic — higher amounts, crypto rails, and missing IDs increase risk
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
      guardscore_version: "1.0.0",
      scored_at: new Date().toISOString(),
    };
  }

  async lookupMerchant(args: {
    merchant_id?: string;
    merchant_name?: string;
    website?: string;
  }): Promise<MerchantProfile> {
    const identifier = args.merchant_id || args.merchant_name || args.website || "unknown";
    logger.info("Looking up merchant", { identifier });

    // Deterministic mock based on identifier hash
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

  async verifyAgent(args: {
    agent_id: string;
    agent_name?: string;
    requesting_action: string;
    transaction_amount?: number;
  }): Promise<AgentVerification> {
    logger.info("Verifying agent", { agent_id: args.agent_id, action: args.requesting_action });

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

  async predictDispute(args: {
    transaction_amount: number;
    merchant_category: string;
    payment_rail: PaymentRail;
    card_type?: string;
    is_recurring?: boolean;
    merchant_id?: string;
  }): Promise<DisputePrediction> {
    logger.info("Predicting dispute", { amount: args.transaction_amount });

    let probability = 0.02; // baseline 2%
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
      probability -= 0.01; // crypto = fewer traditional disputes
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
      model_version: "1.0.0",
    };
  }

  async checkVelocity(args: {
    entity_id: string;
    entity_type: "merchant" | "agent" | "card" | "wallet";
    time_window: string;
    transaction_count?: number;
  }): Promise<VelocityResult> {
    logger.info("Checking velocity", { entity: args.entity_id, window: args.time_window });

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

  async checkCrossRail(args: {
    entity_id: string;
    payment_rails: PaymentRail[];
  }): Promise<CrossRailResult> {
    logger.info("Cross-rail check", { entity: args.entity_id, rails: args.payment_rails });

    const hash = [...args.entity_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const railScores: Record<string, number> = {};
    const patterns: string[] = [];

    for (const rail of args.payment_rails) {
      const railHash = [...(args.entity_id + rail)].reduce((a, c) => a + c.charCodeAt(0), 0);
      railScores[rail] = 50 + (railHash % 45);
    }

    // Cross-rail patterns
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

  async analyzeVAMP(args: {
    merchant_id: string;
    visa_merchant_id?: string;
  }): Promise<VAMPAnalysis> {
    logger.info("VAMP analysis", { merchant: args.merchant_id });

    const hash = [...args.merchant_id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const fraudRate = parseFloat((0.1 + (hash % 20) * 0.05).toFixed(2));
    const disputeRate = parseFloat((0.2 + (hash % 25) * 0.04).toFixed(2));
    const vampScore = Math.round(100 - fraudRate * 20 - disputeRate * 15);
    const actions: string[] = [];

    // Visa VAMP thresholds (2025): standard < 0.65%, monitored < 0.9%, excessive >= 0.9%
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
