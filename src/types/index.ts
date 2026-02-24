export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PaymentRail = "card" | "stablecoin" | "crypto" | "ach" | "wire" | "unknown";
export type VerificationStatus = "verified" | "pending" | "unverified" | "suspended" | "revoked";
export type DisputeType = "fraud" | "product_not_received" | "product_not_as_described" | "duplicate" | "subscription_canceled" | "authorization_issue";
export type VAMPStatus = "standard" | "monitored" | "excessive" | "at_risk";

export interface RiskFactor {
  factor: string;
  severity: RiskLevel;
  description: string;
}

export interface TransactionRiskResult {
  risk_score: number;
  risk_level: RiskLevel;
  recommended_action: "approve" | "review" | "decline";
  risk_factors: RiskFactor[];
  guardscore_version: string;
  scored_at: string;
}

export interface MerchantProfile {
  merchant_id: string;
  name: string;
  guardscore: number;
  risk_level: RiskLevel;
  verification_status: VerificationStatus;
  chargeback_rate: number;
  industry: string;
  vamp_status: VAMPStatus;
  last_updated: string;
}

export interface AgentVerification {
  agent_id: string;
  trust_score: number;
  verification_status: VerificationStatus;
  authorization_level: "none" | "basic" | "standard" | "elevated" | "full";
  spending_limit: number;
  spending_limit_currency: string;
  anomaly_flags: string[];
  verified_at: string;
}

export interface DisputePrediction {
  dispute_probability: number;
  predicted_dispute_type: DisputeType | null;
  risk_level: RiskLevel;
  preventive_actions: string[];
  model_version: string;
}

export interface VelocityResult {
  entity_id: string;
  velocity_score: number;
  anomaly_detected: boolean;
  transactions_in_window: number;
  baseline_average: number;
  pattern_analysis: string;
  time_window: string;
}

export interface CrossRailResult {
  entity_id: string;
  cross_rail_risk_score: number;
  risk_level: RiskLevel;
  rails_analyzed: PaymentRail[];
  suspicious_patterns: string[];
  rail_scores: Record<string, number>;
}

export interface VAMPAnalysis {
  merchant_id: string;
  vamp_score: number;
  vamp_status: VAMPStatus;
  fraud_rate: number;
  dispute_rate: number;
  monthly_trend: "improving" | "stable" | "declining";
  recommended_actions: string[];
  visa_threshold_distance: number;
}
