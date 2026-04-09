import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export async function enqueueJob(input: {
  orgId?: string;
  customerId?: string;
  jobType: string;
  priority?: "high" | "normal" | "low";
  payload?: Prisma.InputJsonValue;
}) {
  return prisma.backgroundJob.create({
    data: {
      orgId: input.orgId,
      customerId: input.customerId,
      jobType: input.jobType,
      priority: input.priority || "normal",
      payload: input.payload || {},
      status: "queued"
    }
  });
}

export async function completeJob(jobId: string, result?: Prisma.InputJsonValue) {
  return prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      result: result || {},
      updatedAt: new Date()
    }
  });
}

export async function failJob(jobId: string, errorMessage: string) {
  const job = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      attempts: { increment: 1 },
      updatedAt: new Date()
    }
  });

  await prisma.failedJob.create({
    data: {
      backgroundJobId: job.id,
      orgId: job.orgId,
      jobType: job.jobType,
      payload: ((job.payload as Prisma.InputJsonValue | null) ?? {}) as Prisma.InputJsonValue,
      errorMessage
    }
  });

  return job;
}
