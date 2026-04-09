import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

function tierForScore(score: number) {
  if (score <= 300) return "unverified";
  if (score <= 600) return "building";
  if (score <= 850) return "trusted";
  return "elite";
}

export async function applyTrustScoreChange(input: {
  customerId: string;
  orgId: string;
  changeAmount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const customer = await prisma.bankCustomer.findUniqueOrThrow({
    where: { id: input.customerId }
  });

  const oldScore = customer.trustScore;
  const newScore = Math.max(0, Math.min(1000, oldScore + input.changeAmount));

  await prisma.$transaction([
    prisma.bankCustomer.update({
      where: { id: input.customerId },
      data: {
        trustScore: newScore,
        riskTier: tierForScore(newScore)
      }
    }),
    prisma.trustScoreHistory.create({
      data: {
        customerId: input.customerId,
        orgId: input.orgId,
        changeAmount: input.changeAmount,
        oldScore,
        newScore,
        reason: input.reason,
        metadata: (input.metadata || {}) as Prisma.InputJsonValue
      }
    })
  ]);

  return newScore;
}
