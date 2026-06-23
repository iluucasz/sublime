import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const { Client } = pg;

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

function buildInsertQuery(table, rows) {
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);

  const valuesList = rows
    .map((row) => {
      const vals = columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";

        if (typeof val === "object") {
          return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        }

        if (typeof val === "string") {
          return `'${val.replace(/'/g, "''")}'`;
        }

        if (typeof val === "boolean") {
          return val ? "TRUE" : "FALSE";
        }

        return String(val);
      });
      return `(${vals.join(", ")})`;
    })
    .join(",\n");

  const cols = columns.map((c) => `"${c}"`).join(", ");

  return `INSERT INTO "public"."${table}" (${cols}) VALUES ${valuesList};`;
}

async function main() {
  loadEnv();

  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT_ID;

  if (!dbPassword || !projectRef) {
    console.error(
      "ERRO: SUPABASE_DB_PASSWORD e SUPABASE_PROJECT_ID sao necessarios no .env"
    );
    process.exit(1);
  }

  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

  console.log(`Conectando ao banco ${projectRef}...`);
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Conectado!\n");

  // Disable triggers/FK checks for migration
  console.log("Desabilitando FK checks...");
  await client.query("SET session_replication_role = 'replica';");

  // Clear any seed data from migrations (reverse order)
  console.log("Limpando dados de seed das migrations...");
  const reverseTables = [...ORDERED_TABLES].reverse();
  for (const table of reverseTables) {
    try {
      await client.query(`DELETE FROM "public"."${table}";`);
    } catch {
      // Table might not exist or be empty - ignore
    }
  }
  console.log("Limpeza concluida!\n");

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

    const batchSize = 100;
    let imported = 0;
    let hasError = false;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const query = buildInsertQuery(table, batch);
      if (!query) continue;

      try {
        await client.query(query);
        imported += batch.length;
        process.stdout.write(".");
      } catch (err) {
        console.log(`\n    ERRO no lote ${Math.floor(i / batchSize) + 1}: ${err.message}`);
        errors.push({ table, row: i, error: err.message });
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      console.log(` ${imported} OK`);
      totalImported += imported;
    }
  }

  // Re-enable triggers
  console.log("\nReabilitando FK checks...");
  await client.query("SET session_replication_role = 'origin';");

  await client.end();

  console.log(`\n=== RESUMO ===`);
  console.log(`Total importado: ${totalImported} registros`);

  if (errors.length > 0) {
    console.log(`\nErros (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ${e.table}: ${e.error}`);
    }
  }
}

main().catch((e) => {
  console.error("Falha ao migrar:", e);
  process.exit(1);
});
