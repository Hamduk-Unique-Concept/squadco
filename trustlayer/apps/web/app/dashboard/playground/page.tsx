import { ApiPlayground } from "../../../components/api-playground";
import { Panel } from "../../../components/shell";
import { createClient } from "../../../lib/supabase/server";

export default async function PlaygroundPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("key_prefix, environment, is_active, name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <Panel title="API Playground" description="Live tester for TrustLayer endpoints against your org credentials.">
      <div className="mb-5 rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm">
        <p className="font-semibold">Recent API keys</p>
        <div className="mt-2 space-y-1 text-[var(--muted)]">
          {(keys || []).map((key) => (
            <p key={`${key.key_prefix}-${key.environment}`}>{key.name} - {key.key_prefix} - {key.environment}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">Paste the full key you copied at creation time. Stored keys cannot be revealed again.</p>
      </div>
      <ApiPlayground baseUrl={apiUrl} />
    </Panel>
  );
}
