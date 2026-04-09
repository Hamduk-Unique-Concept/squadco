import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "./env";

export const supabaseAdmin = createClient(
  serverEnv.supabaseUrl,
  serverEnv.supabaseServiceRoleKey || serverEnv.supabaseAnonKey
);
