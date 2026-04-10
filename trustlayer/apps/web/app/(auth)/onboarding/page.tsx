import { redirect } from "next/navigation";

import { completeOnboardingAction } from "../../actions";
import { getCurrentProfile } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login?error=Sign%20in%20to%20complete%20onboarding");
  }

  const profile = await getCurrentProfile();

  if (profile) {
    redirect(profile.role === "super_admin" ? "/admin" : "/dashboard");
  }

  const metadata = authData.user.user_metadata || {};

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <div className="w-full rounded-[32px] border border-[var(--line)] bg-[var(--panel)] p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--teal)]">Self-Serve Onboarding</p>
        <h1 className="mt-4 text-4xl font-semibold">Finish setting up your TrustLayer workspace</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Create your bank organization, provision sandbox access, and land in the bank admin dashboard.</p>

        <form action={completeOnboardingAction} className="mt-8 grid gap-4 md:grid-cols-2">
          <input className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3" name="full_name" placeholder="Full name" defaultValue={String(metadata.full_name || "")} />
          <input className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3" value={authData.user.email || ""} disabled />
          <input className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 md:col-span-2" name="company_name" placeholder="Company name" defaultValue={String(metadata.company_name || "")} />
          <input className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3" name="slug" placeholder="Workspace slug (optional)" />
          <input className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3" name="country" placeholder="Country" defaultValue={String(metadata.country || "Nigeria")} />
          <textarea className="min-h-32 rounded-3xl border border-[var(--line)] bg-white px-4 py-3 md:col-span-2" name="use_case_description" placeholder="Describe your use case and expected integration" />
          <button className="rounded-2xl bg-[var(--ink)] px-5 py-3 text-white md:col-span-2" type="submit">Complete onboarding</button>
        </form>

        {searchParams?.error ? (
          <p className="mt-4 text-sm text-[var(--coral)]">{decodeURIComponent(searchParams.error)}</p>
        ) : null}
      </div>
    </main>
  );
}
