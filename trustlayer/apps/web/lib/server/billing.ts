import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export async function resetMonthlyUsageCounts() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, apiCallCount: true, monthlyLimit: true, plan: true }
  });

  await prisma.organization.updateMany({ data: { apiCallCount: 0 } });

  await prisma.billingEvent.createMany({
    data: orgs.map((org) => ({
      orgId: org.id,
      eventType: "monthly_reset",
      amountKobo: BigInt(0),
      status: "completed",
      metadata: {
        previous_api_call_count: org.apiCallCount,
        monthly_limit: org.monthlyLimit,
        plan: org.plan
      } as Prisma.InputJsonValue
    }))
  });

  return { reset_count: orgs.length };
}
