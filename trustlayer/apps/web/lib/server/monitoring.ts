export async function captureMessage(message: string, _level: "info" | "warning" | "error" = "info", extra?: Record<string, unknown>) {
  console.log(message, extra || {});
}

export async function captureException(error: unknown, extra?: Record<string, unknown>) {
  console.error(error, extra || {});
}
