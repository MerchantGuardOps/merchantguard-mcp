import { z } from "zod";

const paymentRailEnum = z.enum(["card", "stablecoin", "crypto", "ach", "wire", "unknown"]).describe("Payment rail used for this transaction");

export const transactionRiskSchema = z.object({
  amount: z.number().positive().describe("Transaction amount in the specified currency"),
  currency: z.string().default("USD").describe("ISO 4217 currency code"),
  merchant_category: z.string().describe("Merchant category (e.g., e-commerce, gambling, travel, subscription, digital_goods, pharmaceuticals)"),
  payment_rail: paymentRailEnum,
  merchant_id: z.string().optional().describe("MerchantGuard merchant ID for history lookup"),
  agent_id: z.string().optional().describe("AI agent identifier if transaction is agent-initiated"),
  description: z.string().optional().describe("Transaction description for context"),
});

export const merchantLookupSchema = z.object({
  merchant_id: z.string().optional().describe("MerchantGuard merchant ID"),
  merchant_name: z.string().optional().describe("Business name to search"),
  website: z.string().optional().describe("Merchant website URL"),
});

export const agentVerifySchema = z.object({
  agent_id: z.string().describe("Unique identifier of the AI agent"),
  agent_name: z.string().optional().describe("Human-readable agent name"),
  requesting_action: z.string().describe("Action the agent is attempting (e.g., purchase, refund, transfer_funds, modify_pricing)"),
  transaction_amount: z.number().optional().describe("Amount the agent wants to transact"),
});

export const disputePredictSchema = z.object({
  transaction_amount: z.number().positive().describe("Transaction amount"),
  merchant_category: z.string().describe("Merchant category code or name"),
  payment_rail: paymentRailEnum,
  card_type: z.string().optional().describe("Card network (visa, mastercard, amex, discover)"),
  is_recurring: z.boolean().optional().describe("Whether this is a recurring/subscription charge"),
  merchant_id: z.string().optional().describe("MerchantGuard merchant ID"),
});

export const velocityCheckSchema = z.object({
  entity_id: z.string().describe("ID of the entity to check (merchant, agent, card, or wallet address)"),
  entity_type: z.enum(["merchant", "agent", "card", "wallet"]).describe("Type of entity"),
  time_window: z.string().describe("Time window for velocity check (e.g., '1h', '24h', '7d', '30d')"),
  transaction_count: z.number().optional().describe("Known transaction count in window (if available)"),
});

export const crossRailCheckSchema = z.object({
  entity_id: z.string().describe("ID of the entity to analyze across rails"),
  payment_rails: z.array(paymentRailEnum).min(2).describe("Payment rails to analyze (minimum 2 for cross-rail detection)"),
});

export const vampAnalysisSchema = z.object({
  merchant_id: z.string().describe("MerchantGuard merchant ID"),
  visa_merchant_id: z.string().optional().describe("Visa-assigned merchant ID (VMID) for direct VAMP data"),
});
