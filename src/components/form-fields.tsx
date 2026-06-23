import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";

export type FieldType =
  | "text"
  | "textarea"
  | "yes_no"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "scale"
  | "objective_levels"
  | "family_guidelines";


export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  /** Meta mínima — se o valor preenchido ficar abaixo disto, gera estudo de caso. */
  min_target?: number;
}

/** Níveis usados no campo de objetivos terapêuticos (padrão do relatório transdisciplinar). */
export const OBJECTIVE_LEVELS = [
  { value: "nao_alcancado", label: "Não Alcançado" },
  { value: "emergindo", label: "Emergindo" },
  { value: "alcancado", label: "Alcançado" },
] as const;

export interface ObjectiveRow {
  text: string;
  level: "" | "nao_alcancado" | "emergindo" | "alcancado";
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo (escrita livre)",
  yes_no: "Sim / Não",
  single_choice: "Múltipla escolha (uma)",
  multi_choice: "Múltipla escolha (várias)",
  number: "Número (gera gráfico)",
  scale: "Escala 0–N (gera gráfico)",
  objective_levels: "Objetivos terapêuticos (Não alcançado / Emergindo / Alcançado)",
  family_guidelines: "Orientações à família (estratégia + responsável)",
};

export interface FamilyGuidelineRow {
  guideline: string;
  responsible: string;
}

function cleanReportFieldLabel(label: string | null | undefined) {
  return String(label ?? "")
    .replace(/^\s*anexo\s*\d+\s*[—–-]\s*/i, "")
    .replace(/\s*\([^)]{18,}\)/g, "")
    .split(/\.\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}


export function isChartableField(f: FormField) {
  return f.type === "number" || f.type === "scale";
}


function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Editor para definir os campos (usado em modelos de relatório). */
export function FieldsEditor({
  value,
  onChange,
}: {
  value: FormField[];
  onChange: (next: FormField[]) => void;
}) {
  const fields = Array.isArray(value) ? value : [];

  const update = (i: number, patch: Partial<FormField>) => {
    const next = [...fields];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(fields.filter((_, k) => k !== i));
  const add = () =>
    onChange([...fields, { id: uid(), type: "textarea", label: "Nova pergunta", required: false }]);

  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <Card key={f.id} className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <Label className="text-xs">Pergunta</Label>
                  <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={f.type} onValueChange={(v) => update(i, { type: v as FieldType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(f.type === "single_choice" || f.type === "multi_choice") && (
                <div>
                  <Label className="text-xs">Alternativas (uma por linha)</Label>
                  <Textarea
                    rows={3}
                    value={(f.options ?? []).join("\n")}
                    onChange={(e) =>
                      update(i, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                    }
                    placeholder="Alternativa 1&#10;Alternativa 2"
                  />
                </div>
              )}
              {f.type === "number" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Mínimo (opcional)</Label>
                    <Input type="number" value={f.min ?? ""} onChange={(e) => update(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Máximo (opcional)</Label>
                    <Input type="number" value={f.max ?? ""} onChange={(e) => update(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade (opcional)</Label>
                    <Input value={f.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} placeholder="ex.: %, min" />
                  </div>
                </div>
              )}
              {f.type === "scale" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">De</Label>
                    <Input type="number" value={f.min ?? 0} onChange={(e) => update(i, { min: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <Input type="number" value={f.max ?? 10} onChange={(e) => update(i, { max: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {isChartableField(f) && (
                <>
                  <div>
                    <Label className="text-xs">Meta mínima (opcional — dispara estudo de caso se ficar abaixo)</Label>
                    <Input
                      type="number"
                      value={f.min_target ?? ""}
                      onChange={(e) => update(i, { min_target: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="ex.: 5"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Esta pergunta gera dados numéricos para gráfico de evolução.
                  </p>
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={!!f.required} onCheckedChange={(v) => update(i, { required: !!v })} />
                Obrigatório
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
      </Button>
    </div>
  );
}

/** Renderiza os campos para preenchimento pelo profissional. */
export function FieldsRenderer({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  disabled?: boolean;
}) {
  if (!fields?.length) return null;
  const set = (id: string, v: any) => onChange({ ...values, [id]: v });

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const v = values?.[f.id];
        const label = cleanReportFieldLabel(f.label);
        return (
          <div key={f.id} className="space-y-1">
            <Label className="text-sm">
              {label}
              {f.required && <span className="text-destructive ml-1">*</span>}
              {f.unit && <span className="text-muted-foreground ml-1">({f.unit})</span>}
            </Label>
            {f.type === "text" && (
              <Input value={v ?? ""} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />
            )}
            {f.type === "textarea" && (
              <Textarea rows={4} value={v ?? ""} disabled={disabled} onChange={(e) => set(f.id, e.target.value)} />
            )}
            {f.type === "number" && (
              <Input
                type="number"
                min={f.min}
                max={f.max}
                value={v ?? ""}
                disabled={disabled}
                onChange={(e) => set(f.id, e.target.value === "" ? null : Number(e.target.value))}
              />
            )}
            {f.type === "scale" && (
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: (f.max ?? 10) - (f.min ?? 0) + 1 }, (_, k) => (f.min ?? 0) + k).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={v === n ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => set(f.id, n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            )}
            {f.type === "yes_no" && (
              <RadioGroup value={v ?? ""} onValueChange={(val) => set(f.id, val)} disabled={disabled} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="sim" /> Sim
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="nao" /> Não
                </label>
              </RadioGroup>
            )}
            {f.type === "single_choice" && (
              <RadioGroup value={v ?? ""} onValueChange={(val) => set(f.id, val)} disabled={disabled} className="space-y-1">
                {(f.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={opt} /> {opt}
                  </label>
                ))}
              </RadioGroup>
            )}
            {f.type === "multi_choice" && (
              <div className="space-y-1">
                {(f.options ?? []).map((opt) => {
                  const arr: string[] = Array.isArray(v) ? v : [];
                  const checked = arr.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(c) =>
                          set(f.id, c ? [...arr, opt] : arr.filter((x) => x !== opt))
                        }
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
            {f.type === "objective_levels" && (
              <ObjectiveLevelsInput
                value={Array.isArray(v?.rows) ? v.rows : []}
                disabled={disabled}
                onChange={(rows) => set(f.id, { rows })}
              />
            )}
            {f.type === "family_guidelines" && (
              <FamilyGuidelinesInput
                value={Array.isArray(v?.rows) ? v.rows : []}
                disabled={disabled}
                onChange={(rows) => set(f.id, { rows })}
              />
            )}


          </div>
        );
      })}
    </div>
  );
}

/** Tabela de objetivos terapêuticos com 3 níveis — fiel ao relatório transdisciplinar. */
function ObjectiveLevelsInput({
  value,
  onChange,
  disabled,
}: {
  value: ObjectiveRow[];
  onChange: (rows: ObjectiveRow[]) => void;
  disabled?: boolean;
}) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i: number, patch: Partial<ObjectiveRow>) => {
    const next = rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const add = () => onChange([...rows, { text: "", level: "" }]);
  const remove = (i: number) => onChange(rows.filter((_, k) => k !== i));

  return (
    <div className="space-y-2">
      <div className="hidden md:grid grid-cols-[1fr_auto] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground px-1">
        <span>Objetivo Terapêutico</span>
        <span className="text-center">Não Alcançado · Emergindo · Alcançado</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 border rounded-md p-2">
          <Input
            value={r.text}
            disabled={disabled}
            placeholder="Descreva o objetivo terapêutico"
            onChange={(e) => update(i, { text: e.target.value })}
            className="flex-1"
          />
          <div className="flex gap-1">
            {OBJECTIVE_LEVELS.map((lvl) => (
              <Button
                key={lvl.value}
                type="button"
                size="sm"
                variant={r.level === lvl.value ? "default" : "outline"}
                disabled={disabled}
                onClick={() => update(i, { level: r.level === lvl.value ? "" : lvl.value })}
              >
                {lvl.label}
              </Button>
            ))}
            {!disabled && (
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar objetivo
        </Button>
      )}
      {disabled && rows.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nenhum objetivo registrado.</p>
      )}
    </div>
  );
}

/** Anexo 6 — Orientações à família: pares "Estratégia / Orientação" + "Responsável". */
function FamilyGuidelinesInput({
  value,
  onChange,
  disabled,
}: {
  value: FamilyGuidelineRow[];
  onChange: (rows: FamilyGuidelineRow[]) => void;
  disabled?: boolean;
}) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i: number, patch: Partial<FamilyGuidelineRow>) => {
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };
  const add = () => onChange([...rows, { guideline: "", responsible: "" }]);
  const remove = (i: number) => onChange(rows.filter((_, k) => k !== i));

  return (
    <div className="space-y-2">
      <div className="hidden md:grid grid-cols-[1fr_220px_auto] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground px-1">
        <span>Estratégia / Orientação</span>
        <span>Responsável pela Orientação</span>
        <span></span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2 border rounded-md p-2 items-start">
          <Textarea
            rows={2}
            value={r.guideline}
            disabled={disabled}
            placeholder="Descreva a estratégia ou orientação"
            onChange={(e) => update(i, { guideline: e.target.value })}
          />
          <Input
            value={r.responsible}
            disabled={disabled}
            placeholder="Nome do responsável"
            onChange={(e) => update(i, { responsible: e.target.value })}
          />
          {!disabled && (
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar orientação
        </Button>
      )}
      {disabled && rows.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nenhuma orientação registrada.</p>
      )}
    </div>
  );
}


/** Renderização somente-leitura dos campos (para impressão). */
export function FieldsReadonly({
  fields,
  values,
}: {
  fields: FormField[];
  values: Record<string, any>;
}) {
  if (!fields?.length) return null;
  const levelLabel = (lvl: string) =>
    OBJECTIVE_LEVELS.find((l) => l.value === lvl)?.label ?? "—";

  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const v = values?.[f.id];
        const label = cleanReportFieldLabel(f.label);
        if (f.type === "objective_levels") {
          const objRows: ObjectiveRow[] = Array.isArray(v?.rows) ? v.rows : [];
          if (!objRows.length) return null;
          return (
            <div key={f.id} className="break-inside-avoid">
              <p className="text-sm font-semibold mb-1">{label}</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b">
                    <th className="py-1 pr-2">Objetivo Terapêutico</th>
                    <th className="py-1 px-1 text-center">Não Alcançado</th>
                    <th className="py-1 px-1 text-center">Emergindo</th>
                    <th className="py-1 px-1 text-center">Alcançado</th>
                  </tr>
                </thead>
                <tbody>
                  {objRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-1 pr-2">{r.text || "—"}</td>
                      <td className="py-1 px-1 text-center">{r.level === "nao_alcancado" ? "✓" : ""}</td>
                      <td className="py-1 px-1 text-center">{r.level === "emergindo" ? "✓" : ""}</td>
                      <td className="py-1 px-1 text-center">{r.level === "alcancado" ? "✓" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (f.type === "family_guidelines") {
          const fgRows: FamilyGuidelineRow[] = Array.isArray(v?.rows) ? v.rows : [];
          if (!fgRows.length) return null;
          return (
            <div key={f.id} className="break-inside-avoid">
              <p className="text-sm font-semibold mb-1">{label}</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b">
                    <th className="py-1 pr-2">Estratégia / Orientação para a Família</th>
                    <th className="py-1 px-1 w-[40%]">Responsável pela Orientação</th>
                  </tr>
                </thead>
                <tbody>
                  {fgRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-1 pr-2 whitespace-pre-wrap">{r.guideline || "—"}</td>
                      <td className="py-1 px-1">{r.responsible || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const hasValue = Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";

        if (!hasValue) return null;
        let display: string;
        if (Array.isArray(v)) display = v.join(", ");
        else if (f.type === "yes_no") display = v === "sim" ? "Sim" : v === "nao" ? "Não" : String(v);
        else display = String(v);
        return (
          <div key={f.id} className="break-inside-avoid">
            <span className="text-sm font-semibold">{label}: </span>
            <span className="text-sm whitespace-pre-wrap">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

