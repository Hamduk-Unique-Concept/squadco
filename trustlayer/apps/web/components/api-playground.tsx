"use client";

import { useState } from "react";

const endpointPresets: Record<string, { method: "GET" | "POST"; path: string; body: string }> = {
  "POST /v1/transaction/analyze": {
    method: "POST",
    path: "/api/v1/transaction/analyze",
    body: `{
  "customer_id": "55555555-5555-5555-5555-555555555555",
  "amount": 300000,
  "currency": "NGN",
  "merchant": "POS Terminal",
  "location": "Abuja",
  "device_id": "device_abc",
  "channel": "mobile"
}`
  },
  "POST /v1/customer/register": {
    method: "POST",
    path: "/api/v1/customer/register",
    body: `{
  "external_id": "customer_123",
  "bvn_hash": "hashed_bvn_here",
  "phone_hash": "hashed_phone_here"
}`
  },
  "GET /v1/customer/:external_id/profile": {
    method: "GET",
    path: "/api/v1/customer/demo_customer_001/profile",
    body: ""
  },
  "POST /v1/credit/analyze": {
    method: "POST",
    path: "/api/v1/credit/analyze",
    body: `{
  "customer_id": "55555555-5555-5555-5555-555555555555",
  "data_type": "bank_statement",
  "data": {
    "avg_monthly_inflow": 450000,
    "avg_balance": 180000,
    "salary_detected": true,
    "balance_trend_score": 71
  }
}`
  },
  "POST /v1/assistant/chat": {
    method: "POST",
    path: "/api/v1/assistant/chat",
    body: `{
  "customer_id": "55555555-5555-5555-5555-555555555555",
  "message": "Why was my transaction flagged?",
  "history": []
}`
  },
  "POST /v1/webhooks/register": {
    method: "POST",
    path: "/api/v1/webhooks/register",
    body: `{
  "url": "https://bank.example.com/webhooks/trustlayer",
  "events": ["transaction.analyzed"],
  "secret": "super-secret-webhook-key"
}`
  }
};

type EndpointKey = keyof typeof endpointPresets;

export function ApiPlayground({
  baseUrl,
  defaultApiKey
}: {
  baseUrl: string;
  defaultApiKey?: string;
}) {
  const [selected, setSelected] = useState<EndpointKey>("POST /v1/transaction/analyze");
  const [apiKey, setApiKey] = useState(defaultApiKey || "");
  const [body, setBody] = useState(endpointPresets["POST /v1/transaction/analyze"].body);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);

  async function runRequest() {
    const preset = endpointPresets[selected];
    setLoading(true);
    setResponseText("");

    try {
      const response = await fetch(`${baseUrl}${preset.path}`, {
        method: preset.method,
        headers: {
          "content-type": "application/json",
          "x-trustlayer-key": apiKey
        },
        body: preset.method === "GET" ? undefined : body
      });

      const text = await response.text();
      setResponseText(`HTTP ${response.status}\n\n${text}`);
    } catch (error) {
      setResponseText(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function onEndpointChange(next: EndpointKey) {
    setSelected(next);
    setBody(endpointPresets[next].body);
    setResponseText("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
          placeholder="Paste sandbox or production API key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <select
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
          value={selected}
          onChange={(event) => onEndpointChange(event.target.value as EndpointKey)}
        >
          {Object.keys(endpointPresets).map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <p className="text-xs text-[var(--muted)]">Target: {baseUrl}{endpointPresets[selected].path}</p>
        <textarea
          className="min-h-72 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={endpointPresets[selected].method === "GET"}
        />
        <button className="rounded-2xl bg-[var(--teal)] px-5 py-3 text-white" onClick={runRequest} disabled={loading || !apiKey}>
          {loading ? "Sending..." : "Send request"}
        </button>
      </div>
      <pre className="overflow-auto rounded-2xl bg-[var(--ink)] p-5 text-sm text-white whitespace-pre-wrap">
        {responseText || "Response will appear here."}
      </pre>
    </div>
  );
}
