import { Panel } from "../../../components/shell";

export default function DocsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  return (
    <Panel title="API Documentation" description="OpenAPI JSON for the in-app API routes running on the same Next.js deployment.">
      <div className="space-y-4 rounded-3xl border border-[var(--line)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Endpoint surface now lives under the same deployment at `/api/*`.</p>
        <a href={`${apiUrl}/api/openapi`} className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm">
          Open OpenAPI JSON
        </a>
      </div>
    </Panel>
  );
}
