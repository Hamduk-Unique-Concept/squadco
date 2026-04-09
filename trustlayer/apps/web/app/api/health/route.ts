import { randomUUID } from "crypto";

import { jsonOk } from "../../../lib/server/response";

export async function GET() {
  return jsonOk({ status: "ok" }, randomUUID());
}
