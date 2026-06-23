import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const ORDERED_TABLES = [
  "units",
  "specialties",
  "profiles",
  "operators",
  "patients",
  "professionals",
  "user_roles",
  "report_templates",
  "report_template_modules",
  "reports",
  "assessments",
  "assessment_items",
  "assessment_applications",
  "assessment_results",
  "report_sections",
  "report_section_signers",
  "report_signers",
  "report_audit_log",
  "announcements",
  "announcement_reads",
  "announcement_replies",
  "therapy_grid",
  "edit_audit_log",
  "patient_documents",
  "goals",
  "case_studies",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "suppressed_emails",
];

const DUMP_FILE = resolve(process.cwd(), "public", "db_dump_2026-06-19.json");

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadEnv();

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error(
      "ERRO: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) sao necessarios no .env"
    );
    process.exit(1);
  }

  console.log(`Conectando a ${url}...`);
  const supabase = createClient(url, key, {
    db: { schema: "public" },
  });

  const dump = JSON.parse(readFileSync(DUMP_FILE, "utf-8"));

  let totalImported = 0;
  const errors = [];

  for (const table of ORDERED_TABLES) {
    const rows = dump[table];
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: 0 linhas (pulado)`);
      continue;
    }

    process.stdout.write(`  ${table}: ${rows.length} linhas... `);

    const batchSize = 500;
    let imported = 0;
    let hasError = false;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.log(`\n    ERRO no lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        errors.push({ table, row: i, error: error.message });
        hasError = true;
        break;
      }
      imported += batch.length;
      process.stdout.write(".");
    }

    if (!hasError) {
      console.log(` ${imported} OK`);
      totalImported += imported;
    }
  }

  // Special handling for _summary if present (skip or store as metadata)
  console.log(`\n=== RESUMO ===`);
  console.log(`Total importado: ${totalImported} registros`);

  if (errors.length > 0) {
    console.log(`\nErros (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ${e.table}: ${e.error}`);
    }
    console.log(
      "\nDICA: Se os erros forem de permisso (RLS), use a service_role key no .env como SUPABASE_SERVICE_ROLE_KEY"
    );
  }
}

main().catch((e) => {
  console.error("Falha ao migrar:", e);
  process.exit(1);
});
