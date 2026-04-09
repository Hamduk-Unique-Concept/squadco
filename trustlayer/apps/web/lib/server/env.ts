import "server-only";

export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  aiEngineUrl: process.env.AI_ENGINE_URL || "http://localhost:8000",
  aiEngineSecret: process.env.AI_ENGINE_SECRET || "",
  appBaseUrl: process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "trustlayerai@hamduk.com.ng",
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  sentryDsn: process.env.SENTRY_DSN || ""
};
