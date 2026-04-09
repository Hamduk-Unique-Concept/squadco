import { serverEnv } from "./env";

type InviteEmailInput = {
  to: string;
  invitedByName?: string | null;
  organizationName: string;
  role: "bank_admin" | "bank_developer";
  inviteToken: string;
};

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!serverEnv.resendApiKey) {
    return { sent: false, reason: "missing RESEND_API_KEY" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: serverEnv.resendFromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend failed: ${response.status} ${errorBody}`);
  }

  return { sent: true as const };
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const inviteUrl = `${serverEnv.appBaseUrl}/invite/${encodeURIComponent(input.inviteToken)}`;
  const inviterLine = input.invitedByName ? `${input.invitedByName} invited you to ` : "You were invited to ";
  const roleLabel = input.role === "bank_admin" ? "Bank Admin" : "Bank Developer";

  return sendResendEmail({
    to: input.to,
    subject: `You were invited to ${input.organizationName} on TrustLayer`,
    text: `${inviterLine}${input.organizationName} on TrustLayer as a ${roleLabel}. Accept your invite: ${inviteUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #101719;">
        <h2>TrustLayer AI invite</h2>
        <p>${inviterLine}<strong>${input.organizationName}</strong> on TrustLayer as a <strong>${roleLabel}</strong>.</p>
        <p>Use the link below to sign in and complete setup.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;background:#101719;color:#ffffff;text-decoration:none;border-radius:999px;">Accept invite</a></p>
        <p>If the button does not work, open this URL:</p>
        <p>${inviteUrl}</p>
      </div>
    `
  });
}
