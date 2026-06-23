import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function dumpTable(supabase, tableName) {
  const allRows = [];
  const pageSize = 1000;
  let start = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact" })
      .range(start, start + pageSize - 1);
    
    if (error) {
      console.error(`  ERRO em ${tableName}: ${error.message}`);
      return { table: tableName, error: error.message, count: 0 };
    }
    
    if (!data || data.length === 0) break;
    
    allRows.push(...data);
    start += data.length;
    
    // Se retornou menos que pageSize, chegamos ao fim
    if (data.length < pageSize) break;
  }
  
  return { table: tableName, count: allRows.length, data: allRows };
}

async function main() {
  loadEnv();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("ERRO: SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY não encontrados no .env");
    process.exit(1);
  }

  console.log(`Conectando a ${url}...`);
  const supabase = createClient(url, key);

  const outDir = resolve(process.cwd(), "db_dump", "data");
  mkdirSync(outDir, { recursive: true });

  const summary = [];
  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`Exportando ${table}... `);
    const result = await dumpTable(supabase, table);
    
    if (result.error) {
      summary.push({ table, rows: 0, error: result.error });
      console.log(`ERRO: ${result.error}`);
    } else {
      const fileName = `${table}.json`;
      writeFileSync(resolve(outDir, fileName), JSON.stringify(result.data, null, 2), "utf-8");
      summary.push({ table, rows: result.count });
      totalRows += result.count;
      console.log(`${result.count} registros`);
    }
  }

  // Save summary
  writeFileSync(
    resolve(outDir, "_summary.json"),
    JSON.stringify({ exported_at: new Date().toISOString(), total_rows: totalRows, tables: summary }, null, 2),
    "utf-8"
  );

  console.log("\n=== RESUMO ===");
  for (const s of summary) {
    const status = s.error ? `ERRO: ${s.error}` : `${s.rows} linhas`;
    console.log(`  ${s.table}: ${status}`);
  }
  console.log(`\nTotal: ${totalRows} registros exportados para db_dump/data/`);
}

main().catch((e) => {
  console.error("Falha ao executar dump:", e);
  process.exit(1);
});
