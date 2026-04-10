import { resendVerificationAction } from "../../actions";

export default function VerifyEmailPage({
  searchParams
}: {
  searchParams?: { success?: string; error?: string; email?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <div className="w-full rounded-[32px] border border-[var(--line)] bg-[var(--panel)] p-8 shadow-panel">
        <h1 className="text-4xl font-semibold">Verify your email</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Use the verification email from Supabase Auth. After you confirm the email, you will land in onboarding before the dashboard.</p>
        <form action={resendVerificationAction} className="mt-6 space-y-4">
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" name="email" placeholder="Email" defaultValue={searchParams?.email ? decodeURIComponent(searchParams.email) : ""} />
          <button className="rounded-2xl bg-[var(--ink)] px-4 py-3 text-white">Resend verification</button>
        </form>
        {searchParams?.success ? <p className="mt-4 text-sm text-[var(--teal)]">{decodeURIComponent(searchParams.success)}</p> : null}
        {searchParams?.error ? <p className="mt-4 text-sm text-[var(--coral)]">{decodeURIComponent(searchParams.error)}</p> : null}
      </div>
    </main>
  );
}
