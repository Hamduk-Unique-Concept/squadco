import crypto from "crypto";

import { prisma } from "./prisma";

async function deliverWithRetry(url: string, secret: string, payload: unknown, attempt = 1): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trustlayer-signature": signature
      },
      body
    });

    if (!response.ok) {
      throw new Error("webhook failed");
    }
  } catch {
    if (attempt >= 3) return;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    await deliverWithRetry(url, secret, payload, attempt + 1);
  }
}

export async function sendWebhook(url: string, secret: string, event: string, data: Record<string, unknown>) {
  await deliverWithRetry(url, secret, {
    event,
    timestamp: new Date().toISOString(),
    data
  });
}

export async function fireWebhookEvent(orgId: string, event: string, data: Record<string, unknown>) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      orgId,
      isActive: true,
      events: { has: event }
    }
  });

  for (const webhook of webhooks) {
    void sendWebhook(webhook.url, webhook.secret, event, data);
  }
}
