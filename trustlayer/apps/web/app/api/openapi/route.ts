import crypto from "crypto";

import { jsonOk } from "../../../lib/server/response";

export async function GET() {
  const requestId = crypto.randomUUID();
  return jsonOk({
    openapi: "3.0.0",
    info: {
      title: "TrustLayer API",
      version: "0.1.0"
    },
    paths: {
      "/api/v1/transaction/analyze": { post: { summary: "Analyze a transaction" } },
      "/api/v1/customer/register": { post: { summary: "Register a customer" } },
      "/api/v1/customer/{externalId}/profile": { get: { summary: "Get customer profile" } },
      "/api/v1/credit/analyze": { post: { summary: "Analyze credit" } },
      "/api/v1/assistant/chat": { post: { summary: "Assistant chat" } },
      "/api/v1/webhooks/register": { post: { summary: "Register webhook" } }
    }
  }, requestId);
}
