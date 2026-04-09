import bcrypt from "bcryptjs";
import crypto from "crypto";

import { API_KEY_PREFIX } from "@trustlayer/shared";

export async function hashApiKey(raw: string) {
  return bcrypt.hash(raw, 12);
}

export function hashSensitiveValue(value?: string | null) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateApiKey(environment: "sandbox" | "production") {
  const prefix = environment === "production" ? API_KEY_PREFIX.LIVE : API_KEY_PREFIX.SANDBOX;
  const suffix = crypto.randomBytes(16).toString("hex");
  const raw = `${prefix}${suffix}`;
  return { raw, prefix: raw.slice(0, 12) };
}
