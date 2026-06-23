import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail } from "@/lib/email-sender.server";

const inviteSchema = z.object({
  kind: z.enum(["operator", "professional"]),
  targetId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
});

export const inviteUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_resp_tecnico_or_admin", {
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("Sem permissão para criar acessos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica se já existe usuário com esse e-mail
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const lower = data.email.toLowerCase();
    const existing = existingList?.users?.find(
      (u) => u.email?.toLowerCase() === lower,
    );

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: data.email,
        options: { data: { full_name: data.fullName } },
      });
      if (error) throw new Error(error.message);
      if (!linkData.user?.id) throw new Error("Falha ao criar usuário.");
      userId = linkData.user.id;

      await sendEmail({
        to: data.email,
        subject: "Convite de acesso — ACT Sublime",
        html: renderInviteEmail({
          fullName: data.fullName,
          inviteUrl: linkData.properties.action_link,
        }),
      });
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName, email: data.email });

    if (data.kind === "operator") {
      const { error: linkErr } = await supabaseAdmin
        .from("operators")
        .update({ user_id: userId })
        .eq("id", data.targetId);
      if (linkErr) throw new Error(linkErr.message);
      // trigger sync_operator_cargo_to_role cuida do user_roles
    } else {
      const { error: linkErr } = await supabaseAdmin
        .from("professionals")
        .update({ user_id: userId })
        .eq("id", data.targetId);
      if (linkErr) throw new Error(linkErr.message);
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "profissional" as any },
          { onConflict: "user_id,role" },
        );
    }

    return { ok: true, userId, reused: !!existing };
  });

const resendSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
});

export const resendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_resp_tecnico_or_admin", {
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("Sem permissão para reenviar convite.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);

    await sendEmail({
      to: data.email,
      subject: "Acesso ao sistema — ACT Sublime",
      html: renderInviteEmail({
        fullName: data.fullName,
        inviteUrl: linkData.properties.action_link,
      }),
    });

    return { ok: true };
  });

function renderInviteEmail({ fullName, inviteUrl }: { fullName: string; inviteUrl: string }) {
  const name = fullName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#111827;padding:0;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <h1 style="color:#5b21b6;margin:0 0 8px;">Bem-vindo ao ACT Sublime</h1>
    <p style="color:#6b7280;margin:0 0 24px;">Você foi convidado para acessar o sistema.</p>
    <p style="margin:0 0 16px;">Olá, <strong>${name}</strong>!</p>
    <p style="margin:0 0 24px;">Clique no botão abaixo para criar sua senha e acessar o sistema:</p>
    <a href="${inviteUrl}" style="display:inline-block;background:#5b21b6;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;">Aceitar convite</a>
    <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
      Este link expira em 24 horas. Se você não esperava este convite, ignore este e-mail.
    </p>
  </div>
</body></html>`;
}
