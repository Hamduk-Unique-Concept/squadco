import crypto from "crypto";

import { NextRequest } from "next/server";
import { z } from "zod";

import { getApiKeyAuth, logExternalCall } from "../../../../lib/server/auth";
import { aiEngineService } from "../../../../lib/server/ai-engine";
import { analyzeCredit, analyzeTransaction, registerCustomer } from "../../../../lib/server/external";
import { prisma } from "../../../../lib/server/prisma";
import { jsonError, jsonOk } from "../../../../lib/server/response";

const assistantBuckets = new Map<string, { count: number; resetAt: number }>();

function pathKey(params: { path?: string[] }) {
  return (params.path || []).join("/");
}

async function requireApiAuth(request: NextRequest, requestId: string) {
  const result = await getApiKeyAuth(request);
  if (result.auth) return result.auth;
  if (result.reason === "missing") return jsonError("missing API key", requestId, 401);
  if (result.reason === "invalid") return jsonError("invalid API key", requestId, 401);
  if (result.reason === "rate_limit") return jsonError("rate limit exceeded", requestId, 429);
  if (result.reason === "org_limit") return jsonError("org rate limit exceeded", requestId, 429);
  if (result.reason === "monthly_limit") {
    return jsonError("monthly_call_limit_reached", requestId, 429, { limit: result.limit, used: result.used });
  }
  return jsonError("unauthorized", requestId, 401);
}

async function withAudit(requestId: string, request: NextRequest, auth: Awaited<ReturnType<typeof getApiKeyAuth>>["auth"], response: Response) {
  if (auth) {
    await logExternalCall(auth, requestId, request.method, request.nextUrl.pathname, response.status);
  }
  return response;
}

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireApiAuth(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;

  if (params.path?.[0] === "sandbox" && params.path?.[1] === "customer" && params.path?.[3] === "profile") {
    return withAudit(requestId, request, auth, jsonOk({
      external_id: params.path?.[2],
      trust_score: 575,
      credit_score: 640,
      risk_tier: "building",
      total_transactions: 12,
      flagged_count: 1
    }, requestId));
  }

  if (params.path?.[0] === "customer" && params.path?.[2] === "profile") {
    const externalId = String(params.path?.[1]);
    const customer = await prisma.bankCustomer.findFirst({
      where: { orgId: auth.orgId, externalId }
    });
    if (!customer) return withAudit(requestId, request, auth, jsonError("customer not found", requestId, 404));
    return withAudit(requestId, request, auth, jsonOk({
      trust_score: customer.trustScore,
      credit_score: customer.creditScore,
      risk_tier: customer.riskTier,
      total_transactions: customer.totalTransactions,
      flagged_count: customer.flaggedTransactions
    }, requestId));
  }

  return withAudit(requestId, request, auth, jsonError("not found", requestId, 404));
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const authOrResponse = await requireApiAuth(request, requestId);
  if (authOrResponse instanceof Response) return authOrResponse;
  const auth = authOrResponse;
  const body = await request.json().catch(() => ({}));
  const key = pathKey(params);

  if (key === "transaction/analyze") {
    const parsed = z.object({
      customer_id: z.string().uuid(),
      amount: z.number().int().positive(),
      currency: z.string().default("NGN"),
      merchant: z.string().optional(),
      location: z.string().optional(),
      device_id: z.string().optional(),
      channel: z.string().optional()
    }).safeParse(body);
    if (!parsed.success) return withAudit(requestId, request, auth, jsonError("invalid request", requestId, 400));
    return withAudit(requestId, request, auth, jsonOk(await analyzeTransaction(auth.orgId, parsed.data, requestId), requestId));
  }

  if (key === "customer/register") {
    const parsed = z.object({
      external_id: z.string(),
      bvn_hash: z.string().optional(),
      phone_hash: z.string().optional()
    }).safeParse(body);
    if (!parsed.success) return withAudit(requestId, request, auth, jsonError("invalid request", requestId, 400));
    const customer = await registerCustomer(auth.orgId, parsed.data);
    return withAudit(requestId, request, auth, jsonOk({
      customer_id: customer.id,
      trust_score: customer.trustScore,
      credit_score: customer.creditScore
    }, requestId, 201));
  }

  if (key === "credit/analyze") {
    const parsed = z.object({
      customer_id: z.string().uuid(),
      data_type: z.string(),
      data: z.record(z.any())
    }).safeParse(body);
    if (!parsed.success) return withAudit(requestId, request, auth, jsonError("invalid request", requestId, 400));
    return withAudit(requestId, request, auth, jsonOk(await analyzeCredit(auth.orgId, parsed.data), requestId));
  }

  if (key === "assistant/chat") {
    const parsed = z.object({
      customer_id: z.string().uuid(),
      message: z.string(),
      history: z.array(z.object({ role: z.string(), content: z.string() })).default([])
    }).safeParse(body);
    if (!parsed.success) return withAudit(requestId, request, auth, jsonError("invalid request", requestId, 400));

    const bucketKey = `${auth.orgId}:${parsed.data.customer_id}`;
    const now = Date.now();
    const bucket = assistantBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt < now) {
      assistantBuckets.set(bucketKey, { count: 1, resetAt: now + 60_000 });
    } else {
      if (bucket.count >= 20) {
        return withAudit(requestId, request, auth, jsonError("rate_limit_exceeded", requestId, 429, { retry_after: 60 }));
      }
      bucket.count += 1;
    }

    const customer = await prisma.bankCustomer.findUnique({ where: { id: parsed.data.customer_id } });
    if (!customer) return withAudit(requestId, request, auth, jsonError("customer not found", requestId, 404));

    const transactions = await prisma.transaction.findMany({
      where: { customerId: parsed.data.customer_id },
      take: 20,
      orderBy: { createdAt: "desc" }
    });
    const org = await prisma.organization.findFirst({ where: { id: customer.orgId } });
    const orgSettings = await prisma.orgSetting.findUnique({ where: { orgId: customer.orgId } });

    const categorizedTransactions = await Promise.all(transactions.slice(0, 10).map(async (tx) => {
      try {
        const category = await aiEngineService.categorize<{ category: string }>({ merchant: tx.merchant, description: tx.merchant }, requestId);
        return { amount: Number(tx.amount), merchant: tx.merchant, decision: tx.decision, category: category.category };
      } catch {
        return { amount: Number(tx.amount), merchant: tx.merchant, decision: tx.decision, category: "uncategorized" };
      }
    }));

    const topCategories = Object.entries(categorizedTransactions.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category]) => category);
    const averageMonthlySpend = transactions.length ? Math.round(transactions.reduce((sum, tx) => sum + Number(tx.amount), 0) / transactions.length) : 0;
    const lastFlagged = transactions.find((tx) => tx.decision === "verify" || tx.decision === "block");

    let predictedBalanceLine = "Balance prediction unavailable.";
    try {
      const currentBalanceEstimate = Math.max(0, transactions.reduce((sum, tx) => sum - Number(tx.amount), 1_000_000));
      const prediction = await aiEngineService.predictBalance<{ predicted_balance: number; warning?: string | null }>({
        current_balance: currentBalanceEstimate,
        target_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        transactions: transactions.map((tx) => ({ amount: Number(tx.amount) * -1, merchant: tx.merchant, created_at: tx.createdAt }))
      }, requestId);
      predictedBalanceLine = prediction.warning ? `${prediction.warning} Predicted balance: NGN ${Math.round(prediction.predicted_balance).toLocaleString()}.` : `Predicted balance in 14 days: NGN ${Math.round(prediction.predicted_balance).toLocaleString()}.`;
    } catch {}

    const prompt = [
      `You are ${orgSettings?.preferredAssistantName || "a smart, friendly financial assistant"} for ${org?.name || "this bank"}.`,
      `${orgSettings?.preferredGreeting || ""}`,
      `Trust Score: ${customer.trustScore}/1000 (${customer.riskTier})`,
      `Credit Score: ${customer.creditScore}/850`,
      `Average monthly spend: NGN ${averageMonthlySpend.toLocaleString()}`,
      `Top spending categories: ${topCategories.join(", ") || "unknown"}`,
      `Last flagged transaction: ${lastFlagged ? `${lastFlagged.merchant || "transaction"} was ${lastFlagged.decision}` : "none"}`,
      `Recent transactions: ${JSON.stringify(categorizedTransactions.slice(0, 5))}`,
      predictedBalanceLine,
      "Keep responses under 3 sentences unless a list is clearly better.",
      "If the customer writes in Nigerian Pidgin, respond in Pidgin."
    ].join("\n");

    let reply = "I can help explain your recent transactions, spending pattern, and next steps to improve your financial profile.";
    try {
      const result = await aiEngineService.explain<{ explanation: string }>({
        prompt_type: "assistant_chat",
        context_data: { prompt: `${prompt}\nConversation: ${JSON.stringify(parsed.data.history)}\nCustomer: ${parsed.data.message}` }
      }, requestId);
      reply = result.explanation;
    } catch {
      reply = lastFlagged ? `Your last flagged transaction was marked ${lastFlagged.decision}. Review unusual amount, device, or location changes and try again if needed.` : "Your account looks active. Keep savings consistent and avoid unusual device or location changes to maintain a strong profile.";
    }

    return withAudit(requestId, request, auth, jsonOk({
      reply,
      suggested_actions: ["Review spending categories", "Check balance outlook", "View customer profile"]
    }, requestId));
  }

  if (key === "webhooks/register") {
    const parsed = z.object({ url: z.string().url(), events: z.array(z.string()), secret: z.string().min(8) }).safeParse(body);
    if (!parsed.success) return withAudit(requestId, request, auth, jsonError("invalid request", requestId, 400));
    const webhook = await prisma.webhook.create({ data: { orgId: auth.orgId, ...parsed.data } });
    return withAudit(requestId, request, auth, jsonOk({ webhook_id: webhook.id }, requestId, 201));
  }

  if (key === "sandbox/transaction/analyze") {
    return withAudit(requestId, request, auth, jsonOk({
      transaction_id: "sandbox_tx_001",
      risk_score: 42,
      decision: "verify",
      ai_explanation: "This payment is higher than usual and came from a new device, so extra verification is needed.",
      risk_factors: [{ type: "amount_deviation", ratio: 3.4, severity: "medium" }, { type: "new_device", severity: "medium" }]
    }, requestId));
  }
  if (key === "sandbox/customer/register") {
    return withAudit(requestId, request, auth, jsonOk({ customer_id: "sandbox_customer_001", trust_score: 500, credit_score: 0 }, requestId, 201));
  }
  if (key === "sandbox/credit/analyze") {
    return withAudit(requestId, request, auth, jsonOk({
      credit_score: 650,
      rating: "Good",
      breakdown: { transaction_history: 72, bank_statement: 68, bvn_identity: 90, behavioral: 65, airtime: 55 },
      loan_eligibility: "Eligible for loans up to ₦500,000",
      improvement_tips: ["Upload your bank statement", "Maintain consistent monthly savings"]
    }, requestId));
  }
  if (key === "sandbox/assistant/chat") {
    return withAudit(requestId, request, auth, jsonOk({
      reply: "Your spending is fairly stable, but consistent monthly savings would strengthen your profile.",
      suggested_actions: ["Upload bank statement", "Review savings"]
    }, requestId));
  }
  if (key === "sandbox/webhooks/register") {
    return withAudit(requestId, request, auth, jsonOk({ webhook_id: "sandbox_webhook_001" }, requestId, 201));
  }

  return withAudit(requestId, request, auth, jsonError("not found", requestId, 404));
}
