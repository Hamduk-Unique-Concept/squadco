import { serverEnv } from "./env";

type UpstashResponse<T> = { result?: T };

async function command<T>(...args: Array<string | number>) {
  if (!serverEnv.upstashRedisRestUrl || !serverEnv.upstashRedisRestToken) {
    return null;
  }

  const response = await fetch(`${serverEnv.upstashRedisRestUrl}/${args.map((part) => encodeURIComponent(String(part))).join("/")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.upstashRedisRestToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash command failed: ${response.status}`);
  }

  const json = await response.json() as UpstashResponse<T>;
  return json.result ?? null;
}

export async function incrementWindow(key: string, ttlSeconds: number) {
  const count = await command<number>("incr", key);
  if (count === 1) {
    await command("expire", key, ttlSeconds);
  }
  return count ?? 0;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await command<string>("get", key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number) {
  await command("set", key, JSON.stringify(value));
  if (ttlSeconds) {
    await command("expire", key, ttlSeconds);
  }
}

export async function delKey(key: string) {
  await command("del", key);
}
