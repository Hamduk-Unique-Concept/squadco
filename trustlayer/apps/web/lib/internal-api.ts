import { createClient } from "./supabase/server";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL || "http://localhost:3000";
}

export async function callInternalApi<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("No active Supabase session");
  }

  const response = await fetch(`${getApiUrl()}/api/internal${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Internal API request failed with ${response.status}`);
  }

  return body.data as T;
}
