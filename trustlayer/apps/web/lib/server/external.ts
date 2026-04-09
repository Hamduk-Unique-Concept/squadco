import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { aiEngineService } from "./ai-engine";
import { hashSensitiveValue } from "./hash";
import { applyTrustScoreChange } from "./trust-score";
import { fireWebhookEvent } from "./webhook";
import { delKey, getJson, setJson } from "./upstash";
import { captureMessage } from "./monitoring";

type AnalyzeRiskResult = {
  risk_score: number;
  risk_factors: Array<Record<string, unknown>>;
  decision: "allow" | "verify" | "block";
};

type CreditResult = {
  credit_score: number;
  rating: string;
  breakdown: Record<string, number>;
  loan_eligibility: string;
};

async function getCustomerBaseline(customerId: string) {
  const cacheKey = `baseline:${customerId}`;
  try {
    const cached = await getJson<{
      avg_amount: number;
      known_locations: string[];
      foreign_locations: string[];
      known_devices: string[];
      usual_channels: string[];
      transactions_last_10m: number;
      trust_score: number;
    }>(cacheKey);
    if (cached) return cached;
  } catch {
    await captureMessage("Baseline cache read failed", "warning", { customerId });
  }

  const [customer, history, velocityCount] = await Promise.all([
    prisma.bankCustomer.findUniqueOrThrow({ where: { id: customerId } }),
    prisma.transaction.findMany({
      where: {
        customerId,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.transaction.count({
      where: {
        customerId,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
      }
    })
  ]);

  const avgAmount = history.length ? history.reduce((sum, item) => sum + Number(item.amount), 0) / history.length : 1;
  const baseline = {
    avg_amount: avgAmount,
    known_locations: [...new Set(history.map((item) => item.location).filter(Boolean))],
    foreign_locations: [],
    known_devices: [...new Set(history.map((item) => item.deviceId).filter(Boolean))],
    usual_channels: [...new Set(history.map((item) => item.channel).filter(Boolean))],
    transactions_last_10m: velocityCount,
    trust_score: customer.trustScore
  };

  try {
    await setJson(cacheKey, baseline, 300);
  } catch {
    await captureMessage("Baseline cache write failed", "warning", { customerId });
  }
  return baseline;
}

async function getOrgFailOpenMode(orgId: string) {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId } });
  return settings?.failOpenMode || "verify";
}

function fallbackCreditTips(breakdown: Record<string, number>): string[] {
  return Object.entries(breakdown).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([key]) => {
    if (key === "bank_statement") return "Upload a clearer bank statement or CSV with readable transaction lines.";
    if (key === "transaction_history") return "Maintain more consistent income and savings activity over time.";
    if (key === "bvn_identity") return "Complete BVN verification to strengthen your identity profile.";
    if (key === "behavioral") return "Keep transaction behavior predictable and consistently pass security checks.";
    if (key === "airtime") return "Maintain regular airtime and data recharge activity.";
    return "Improve this weak area to increase your score.";
  });
}

export async function registerCustomer(orgId: string, payload: { external_id: string; bvn_hash?: string; phone_hash?: string }) {
  return prisma.bankCustomer.create({
    data: {
      orgId,
      externalId: payload.external_id,
      bvnHash: hashSensitiveValue(payload.bvn_hash),
      phoneHash: hashSensitiveValue(payload.phone_hash),
      trustScore: 500,
      creditScore: 0,
      riskTier: "building"
    }
  });
}

export async function analyzeTransaction(orgId: string, payload: {
  customer_id: string;
  amount: number;
  currency?: string;
  merchant?: string;
  location?: string;
  device_id?: string;
  channel?: string;
}, requestId?: string) {
  const baseline = await getCustomerBaseline(payload.customer_id);
  let analysis: AnalyzeRiskResult;

  try {
    analysis = await aiEngineService.analyzeRisk<AnalyzeRiskResult>({
      transaction: { ...payload, timestamp: new Date().toISOString() },
      baseline
    }, requestId);
  } catch {
    const failOpenMode = await getOrgFailOpenMode(orgId);
    analysis = {
      risk_score: 50,
      decision: failOpenMode === "allow" ? "allow" : "verify",
      risk_factors: [{ type: "engine_unavailable", severity: "high" }]
    };
  }

  const transaction = await prisma.transaction.create({
    data: {
      orgId,
      customerId: payload.customer_id,
      amount: payload.amount,
      currency: payload.currency || "NGN",
      merchant: payload.merchant,
      location: payload.location,
      deviceId: payload.device_id,
      channel: payload.channel,
      riskScore: analysis.risk_score,
      riskFactors: analysis.risk_factors as Prisma.InputJsonValue,
      decision: analysis.decision,
      aiExplanation: "Analyzing...",
      status: analysis.decision === "allow" ? "approved" : analysis.decision === "verify" ? "flagged" : "declined"
    }
  });

  await prisma.bankCustomer.update({
    where: { id: payload.customer_id },
    data: {
      totalTransactions: { increment: 1 },
      flaggedTransactions: analysis.decision === "allow" ? undefined : { increment: 1 },
      lastActivityAt: new Date()
    }
  });

  if (analysis.decision === "allow") {
    void delKey(`baseline:${payload.customer_id}`).catch(() => undefined);
    await applyTrustScoreChange({ customerId: payload.customer_id, orgId, changeAmount: 5, reason: "Successful transaction with no flags", metadata: { transaction_id: transaction.id } });
  }
  if (analysis.decision === "block") {
    await applyTrustScoreChange({ customerId: payload.customer_id, orgId, changeAmount: -30, reason: "Transaction blocked by security engine", metadata: { transaction_id: transaction.id } });
  }
  if (analysis.risk_factors.some((factor) => factor.type === "high_velocity")) {
    await applyTrustScoreChange({ customerId: payload.customer_id, orgId, changeAmount: -15, reason: "High velocity pattern detected", metadata: { transaction_id: transaction.id } });
  }

  void fireWebhookEvent(orgId, "transaction.analyzed", {
    transaction_id: transaction.id,
    risk_score: analysis.risk_score,
    decision: analysis.decision,
    ai_explanation: "Analyzing..."
  });

  void aiEngineService.explain<{ explanation: string }>({
    prompt_type: "risk_explanation",
    context_data: {
      risk_factors: analysis.risk_factors,
      risk_score: analysis.risk_score,
      decision: analysis.decision
    }
  }, requestId).then(async (explanation) => {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { aiExplanation: explanation.explanation }
    });
    await fireWebhookEvent(orgId, `transaction.${analysis.decision}`, {
      transaction_id: transaction.id,
      risk_score: analysis.risk_score,
      decision: analysis.decision,
      ai_explanation: explanation.explanation
    });
  }).catch(async () => {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { aiExplanation: "This transaction was flagged by our security system. Please contact your bank if you believe this is an error." }
    });
  });

  return {
    transaction_id: transaction.id,
    risk_score: analysis.risk_score,
    decision: analysis.decision,
    ai_explanation: "Analyzing...",
    risk_factors: analysis.risk_factors
  };
}

export async function analyzeCredit(orgId: string, payload: { customer_id: string; data_type: string; data: Record<string, unknown> }) {
  await prisma.creditInput.create({
    data: {
      orgId,
      customerId: payload.customer_id,
      inputType: payload.data_type,
      data: payload.data as Prisma.InputJsonValue
    }
  });

  const inputs = await prisma.creditInput.findMany({ where: { orgId, customerId: payload.customer_id } });
  const sources = Object.fromEntries(inputs.map((item) => [item.inputType, item.data]));
  const scored = await aiEngineService.scoreCredit<CreditResult>({ sources });
  let improvementTips = fallbackCreditTips(scored.breakdown);
  try {
    const tips = await aiEngineService.explain<{ explanation: string }>({
      prompt_type: "credit_tips",
      context_data: { breakdown: scored.breakdown }
    });
    improvementTips = tips.explanation.split(/\n|;/).map((item) => item.trim().replace(/^[-*]\s*/, "")).filter(Boolean).slice(0, 3);
  } catch {
    improvementTips = fallbackCreditTips(scored.breakdown);
  }

  await prisma.bankCustomer.update({ where: { id: payload.customer_id }, data: { creditScore: scored.credit_score } });

  if (payload.data_type === "bank_statement" && (payload.data.parse_metadata as { status?: string } | undefined)?.status !== "unreadable") {
    await applyTrustScoreChange({
      customerId: payload.customer_id,
      orgId,
      changeAmount: 25,
      reason: "Bank statement uploaded and analyzed",
      metadata: { input_type: payload.data_type }
    });
  }

  return { ...scored, improvement_tips: improvementTips };
}
