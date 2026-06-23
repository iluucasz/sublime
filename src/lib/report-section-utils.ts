export function selectProfessionalSection(sections: any[] | undefined, professional: any) {
  if (!sections?.length || !professional || typeof professional !== "object") return null;
  const professionalId = professional.id;
  const specialtyId = professional.specialty_id;
  if (!professionalId && !specialtyId) return null;
  return (
    sections.find((section: any) => professionalId && section.professional_id === professionalId) ??
    sections.find((section: any) => specialtyId && section.specialty_id === specialtyId) ??
    null
  );
}

function formatBR(date?: string | null) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function buildPatientFieldValues(fields: any[], patient?: any, period?: { start?: string | null; end?: string | null }) {
  if (!patient || !Array.isArray(fields)) return {};
  const values: Record<string, any> = {};
  const periodStr = period?.start || period?.end
    ? `${formatBR(period?.start)}${period?.start && period?.end ? " a " : ""}${formatBR(period?.end)}`
    : "";
  for (const f of fields) {
    const id = String(f?.id ?? "");
    const label = String(f?.label ?? "").toLowerCase();
    const matches = (k: string, labelKey: string) => id === k || label.includes(labelKey);
    if (matches("a1_nome", "nome do aprendiz")) values[id] = patient.full_name ?? "";
    else if (matches("a1_dn", "data de nascimento")) values[id] = formatBR(patient.birth_date);
    else if (matches("a1_cid", "diagnóstico") || label.includes("cid")) values[id] = patient.main_diagnosis ?? "";
    else if (matches("a1_periodo", "período de referência")) values[id] = periodStr;
    else if (matches("a1_resp", "responsável")) values[id] = patient.guardian_name ?? "";
    else if (matches("a1_contato", "contato")) values[id] = patient.guardian_phone ?? "";
  }
  return values;
}

export function buildSectionsFromTemplateAndGrid({
  modules,
  grid,
  reportId,
  userId,
  patient,
  period,
}: {
  modules?: any[] | null;
  grid?: any[] | null;
  reportId: string;
  userId?: string;
  patient?: any;
  period?: { start?: string | null; end?: string | null };
}) {
  const profBySpec = new Map<string, string>();
  (grid ?? []).forEach((item: any) => {
    if (item.specialty_id && item.professional_id && !profBySpec.has(item.specialty_id)) {
      profBySpec.set(item.specialty_id, item.professional_id);
    }
  });
  const gridSpecialties = new Set<string>(
    (grid ?? []).map((item: any) => item.specialty_id).filter(Boolean),
  );

  const seededSpecialties = new Set<string>();
  const rows = (modules ?? [])
    .filter((module: any) => !module.specialty_id || gridSpecialties.has(module.specialty_id))
    .map((module: any) => {
      if (module.specialty_id) seededSpecialties.add(module.specialty_id);
      const fields = module.fields ?? [];
      const isIdentification = !module.specialty_id && /identifica[cç][aã]o\s+do\s+aprendiz/i.test(module.title ?? "");
      const field_values = isIdentification ? buildPatientFieldValues(fields, patient, period) : {};
      return {
        report_id: reportId,
        title: module.title,
        specialty_id: module.specialty_id,
        professional_id: module.specialty_id ? profBySpec.get(module.specialty_id) ?? null : null,
        content: module.description ?? null,
        order_index: module.order_index,
        fields,
        field_values,
        created_by: userId,
        updated_by: userId,
      };
    });

  const missingSpecialties = [...profBySpec.keys()].filter((specialtyId) => !seededSpecialties.has(specialtyId));
  const extraRows = missingSpecialties.map((specialtyId, index) => ({
    report_id: reportId,
    title: "Área do profissional",
    specialty_id: specialtyId,
    professional_id: profBySpec.get(specialtyId) ?? null,
    content: null,
    order_index: 1000 + index,
    fields: [],
    field_values: {},
    created_by: userId,
    updated_by: userId,
  }));

  return [...rows, ...extraRows];
}