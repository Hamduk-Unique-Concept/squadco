import { NextResponse } from "next/server";

export function jsonOk(data: unknown, requestId: string, status = 200) {
  return NextResponse.json({
    request_id: requestId,
    data
  }, { status, headers: { "x-request-id": requestId } });
}

export function jsonError(message: string, requestId: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({
    request_id: requestId,
    error: message,
    ...(extra || {})
  }, { status, headers: { "x-request-id": requestId } });
}
