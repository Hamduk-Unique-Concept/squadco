import { signInAction } from "../../actions";

export default function LoginPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
  };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <div className="grid w-full gap-8 rounded-[32px] border border-[var(--line)] bg-[var(--panel)] p-8 shadow-panel md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--teal)]">Dashboard Access</p>
          <h1 className="mt-4 text-5xl font-semibold">Sign in to TrustLayer</h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Use Supabase Auth for production. This scaffold leaves the auth client boundary ready for email/password and invite completion flows.
          </p>
        </div>
        <form action={signInAction} className="space-y-4">
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Email" name="email" />
          <input className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3" placeholder="Password" type="password" name="password" />
          <button className="w-full rounded-2xl bg-[var(--ink)] px-4 py-3 text-white" type="submit">Sign in</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <a className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-center" href="/signup">Create account</a>
            <a className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-center" href="/forgot-password">Forgot password</a>
          </div>
          {searchParams?.error ? (
            <p className="text-sm text-[var(--coral)]">{decodeURIComponent(searchParams.error)}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
