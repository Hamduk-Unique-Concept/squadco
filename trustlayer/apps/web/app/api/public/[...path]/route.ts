import crypto from "crypto";

import { NextRequest } from "next/server";
import { z } from "zod";

import { jsonError, jsonOk } from "../../../../lib/server/response";
import { prisma } from "../../../../lib/server/prisma";
import { supabaseAdmin } from "../../../../lib/server/supabase-admin";

function getSegments(params: { path?: string[] }) {
  return params.path || [];
}

export async function GET(_request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const segments = getSegments(params);

  if (segments[0] === "invitations" && segments[1]) {
    const token = String(segments[1]);
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) return jsonError("invite not found", requestId, 404);
    if (Date.now() - new Date(invitation.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000) {
      return jsonError("invite expired", requestId, 410);
    }
    if (invitation.acceptedAt) return jsonError("invite already accepted", requestId, 409);
    const organization = invitation.orgId ? await prisma.organization.findUnique({ where: { id: invitation.orgId } }) : null;
    return jsonOk({
      email: invitation.email,
      role: invitation.role,
      organization_name: organization?.name || "TrustLayer"
    }, requestId);
  }

  return jsonError("not found", requestId, 404);
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const requestId = crypto.randomUUID();
  const segments = getSegments(params);
  const body = await request.json().catch(() => ({}));

  if (segments[0] === "invitations" && segments[1] === "accept") {
    const parsed = z.object({
      token: z.string(),
      full_name: z.string().min(2),
      password: z.string().min(8)
    }).safeParse(body);

    if (!parsed.success) return jsonError("invalid request", requestId, 400);

    const invitation = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
    if (!invitation) return jsonError("invite not found", requestId, 404);
    if (Date.now() - new Date(invitation.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000) {
      return jsonError("invite expired", requestId, 410);
    }
    if (invitation.acceptedAt) return jsonError("invite already accepted", requestId, 409);

    const existingProfile = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingProfile) return jsonError("user with that email already exists", requestId, 409);

    const createResult = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name }
    });

    if (createResult.error || !createResult.data.user) {
      return jsonError(createResult.error?.message || "failed to create auth user", requestId, 400);
    }

    const user = createResult.data.user;
    await prisma.$transaction([
      prisma.user.create({
        data: {
          id: user.id,
          orgId: invitation.orgId || null,
          role: invitation.role,
          fullName: parsed.data.full_name,
          email: invitation.email
        }
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() }
      })
    ]);

    return jsonOk({ accepted: true, email: invitation.email }, requestId, 201);
  }

  return jsonError("not found", requestId, 404);
}
