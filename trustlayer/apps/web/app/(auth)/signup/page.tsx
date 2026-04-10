import Link from "next/link";

import { signUpAction } from "../../actions";

export default function SignupPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    success?: string;
  };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <div className="grid w-full gap-8 rounded-[32px] border border-[var(--line)] bg-[var(--panel)] p-8 shadow-panel lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--teal)]">Self-Serve Signup</p>
          <h1 className="mt-4 text-5xl font-semibold">Create your TrustLayer workspace</h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--muted)]">
            Start in sandbox mode, verify your email with Supabase Auth, then complete onboarding and land in your bank admin dashboard.
          </p>
          <div className="mt-8 space-y-3 text-sm text-[var(--muted)]">
            <p>What happens next:</p>
            <p>1. Create your account</p>
            <p>2. Verify your email</p>
            <p>3. Complete company onboarding</p>
            <p>4. Receive a sandbox-ready dashboard</p>
          </div>
        </div>

        <form action={signUpAction} className="space-y-4">
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Full name" name="full_name" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Company name" name="company_name" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Country" name="country" defaultValue="Nigeria" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Work email" name="email" type="email" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Password" name="password" type="password" />
          <button className="w-full rounded-2xl bg-[var(--ink)] px-4 py-3 text-white" type="submit">Create account</button>
          <p className="text-sm text-[var(--muted)]">
            Already have an account? <Link href="/login" className="underline underline-offset-4">Sign in</Link>
          </p>
          {searchParams?.success ? (
            <p className="text-sm text-[var(--teal)]">{decodeURIComponent(searchParams.success)}</p>
          ) : null}
          {searchParams?.error ? (
            <p className="text-sm text-[var(--coral)]">{decodeURIComponent(searchParams.error)}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
