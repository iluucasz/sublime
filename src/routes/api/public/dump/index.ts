import { createFileRoute } from "@tanstack/react-router";

const TABLES = [
  "announcement_reads",
  "announcement_replies",
  "announcements",
  "assessment_applications",
  "assessment_items",
  "assessment_results",
  "assessments",
  "case_studies",
  "edit_audit_log",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "goals",
  "operators",
  "patient_documents",
  "patients",
  "professionals",
  "profiles",
  "report_audit_log",
  "report_section_signers",
  "report_sections",
  "report_signers",
  "report_template_modules",
  "report_templates",
  "reports",
  "specialties",
  "suppressed_emails",
  "therapy_grid",
  "units",
  "user_roles",
];

export const Route = createFileRoute("/api/public/dump/")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const result: Record<string, any> = {};
        const summary: any[] = [];
        let total = 0;

        for (const table of TABLES) {
          const allRows: any[] = [];
          const pageSize = 1000;
          let start = 0;

          while (true) {
            const { data, error } = await supabaseAdmin
              .from(table)
              .select("*")
              .range(start, start + pageSize - 1);

            if (error) {
              summary.push({ table, rows: 0, error: error.message });
              break;
            }

            if (!data || data.length === 0) break;
            allRows.push(...data);
            start += data.length;
            if (data.length < pageSize) break;
          }

          if (!summary.find((s: any) => s.table === table)) {
            summary.push({ table, rows: allRows.length });
            total += allRows.length;
          }

          result[table] = allRows;
        }

        result._summary = { exported_at: new Date().toISOString(), total_rows: total, tables: summary };

        return Response.json(result);
      },
    },
  },
});
