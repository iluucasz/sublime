import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail } from "@/lib/email-sender.server";

export const sendReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; reportId: string; message?: string }) => {
    if (!input?.to || !input.to.includes("@")) throw new Error("E-mail inválido.");
    if (!input.reportId) throw new Error("Relatório inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load report + sections to compose the email
    const { data: report, error: rErr } = await supabase
      .from("reports")
      .select("*, patients(full_name)")
      .eq("id", data.reportId)
      .single();
    if (rErr || !report) throw new Error("Relatório não encontrado.");

    const { data: sections } = await supabase
      .from("report_sections")
      .select("title, content, specialties(name), professionals(full_name)")
      .eq("report_id", data.reportId)
      .order("order_index");

    const html = renderEmailHtml({ report, sections: sections ?? [], message: data.message });
    const subject = `Relatório de acompanhamento — ${report.patients?.full_name ?? "Paciente"}`;

    await sendEmail({ to: data.to, subject, html });

    return { ok: true };
  });

function renderEmailHtml({
  report,
  sections,
  message,
}: {
  report: any;
  sections: any[];
  message?: string;
}) {
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
  const sectionsHtml = sections
    .map(
      (s: any) => `
      <div style="margin: 24px 0;">
        <h3 style="color:#5b21b6;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 8px;">${escapeHtml(s.title)}</h3>
        <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">
          ${s.specialties?.name ? `Área: ${escapeHtml(s.specialties.name)}` : ""}
          ${s.professionals?.full_name ? ` · ${escapeHtml(s.professionals.full_name)}` : ""}
        </p>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;color:#111827;">${escapeHtml(s.content ?? "")}</div>
      </div>`
    )
    .join("");

  return `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#111827;padding:0;margin:0;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <h1 style="color:#5b21b6;margin:0 0 4px;">Relatório de Acompanhamento</h1>
      <p style="color:#6b7280;margin:0 0 16px;">Sublime · Acompanhamento Transdisciplinar</p>
      ${message ? `<p style="font-size:14px;">${escapeHtml(message)}</p>` : ""}
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#6b7280;">Paciente</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(report.patients?.full_name ?? "—")}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Período</td><td style="padding:4px 0;">${fmt(report.period_start)} a ${fmt(report.period_end)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Título</td><td style="padding:4px 0;">${escapeHtml(report.title)}</td></tr>
      </table>
      ${report.general_notes ? `<p style="white-space:pre-wrap;font-size:14px;line-height:1.55;">${escapeHtml(report.general_notes)}</p>` : ""}
      ${sectionsHtml}
      <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;">
        Este e-mail foi enviado pela equipe Sublime. Em caso de dúvidas, responda este e-mail.
      </p>
    </div>
  </body></html>`;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
