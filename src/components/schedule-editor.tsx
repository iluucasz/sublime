import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type DaySchedule = {
  active: boolean;
  start: string;
  end: string;
  break: string; // "01:00", "00:30", etc.
};

const DAYS = [
  { key: "seg", short: "Seg", full: "Segunda" },
  { key: "ter", short: "Ter", full: "Terça" },
  { key: "qua", short: "Qua", full: "Quarta" },
  { key: "qui", short: "Qui", full: "Quinta" },
  { key: "sex", short: "Sex", full: "Sexta" },
  { key: "sab", short: "Sáb", full: "Sábado" },
  { key: "dom", short: "Dom", full: "Domingo" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];
type ScheduleMap = Record<DayKey, DaySchedule>;

// ─── Aliases for parsing ──────────────────────────────────────────────────────

const DAY_ALIASES: Record<string, DayKey> = {
  seg: "seg", segunda: "seg", "segunda-feira": "seg",
  ter: "ter", terca: "ter", "terca-feira": "ter", terça: "ter",
  qua: "qua", quarta: "qua",
  qui: "qui", quinta: "qui",
  sex: "sex", sexta: "sex",
  sab: "sab", sabado: "sab", sábado: "sab",
  dom: "dom", domingo: "dom",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDay(): DaySchedule {
  return { active: false, start: "", end: "", break: "" };
}

function emptyMap(): ScheduleMap {
  return DAYS.reduce((acc, d) => {
    acc[d.key] = emptyDay();
    return acc;
  }, {} as ScheduleMap);
}

const WEEKDAYS: DayKey[] = ["seg", "ter", "qua", "qui", "sex"];

function defaultMap(): ScheduleMap {
  const map = emptyMap();
  for (const key of WEEKDAYS) {
    map[key] = { active: true, start: "08:00", end: "17:00", break: "01:00" };
  }
  return map;
}

function normalizeTime(s: string): string {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return "";
  const h = Math.min(23, parseInt(m[1], 10));
  const mm = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parse(text: string): ScheduleMap {
  const map = emptyMap();
  if (!text) return map;
  for (const part of text.split(/[;\n]/)) {
    const [rawDay, rest] = part.split(":");
    if (!rawDay || !rest) continue;
    const key = DAY_ALIASES[rawDay.trim().toLowerCase().replace(/\.$/, "")];
    if (!key) continue;
    // Match "08:00-18:00" or "08:00-18:00 (1h)" etc.
    const rangeM = rest.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (!rangeM) continue;
    const breakM = rest.match(/\((\d{1,2}[h:]\d{0,2})\s*(?:int(?:ervalo)?)?\)/i)
      ?? rest.match(/int[^\d]*(\d{1,2}[h:]\d{0,2})/i);
    let breakVal = "";
    if (breakM) {
      const raw = breakM[1].replace("h", ":").replace(/:$/, ":00");
      breakVal = normalizeTime(raw);
    }
    map[key] = {
      active: true,
      start: normalizeTime(rangeM[1]),
      end: normalizeTime(rangeM[2]),
      break: breakVal,
    };
  }
  return map;
}

function serialize(map: ScheduleMap): string {
  const out: string[] = [];
  for (const d of DAYS) {
    const s = map[d.key];
    if (!s.active || !s.start || !s.end) continue;
    const breakPart = s.break ? ` (int. ${s.break})` : "";
    out.push(`${d.full.slice(0, 3)}: ${s.start}-${s.end}${breakPart}`);
  }
  return out.join("; ");
}

// ─── Day grid ─────────────────────────────────────────────────────────────────

function ScheduleGrid({
  map,
  onChange,
}: {
  map: ScheduleMap;
  onChange: (next: ScheduleMap) => void;
}) {
  return (
    <div className="rounded-lg border divide-y">
      {DAYS.map((d) => {
        const s = map[d.key];
        return (
          <div
            key={d.key}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors",
              s.active ? "bg-primary/5" : "opacity-60",
            )}
          >
            {/* Toggle */}
            <button
              type="button"
              onClick={() =>
                onChange({ ...map, [d.key]: { ...s, active: !s.active } })
              }
              className={cn(
                "w-10 h-10 rounded-lg text-xs font-bold shrink-0 transition-all",
                s.active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {d.short}
            </button>

            {/* Day name */}
            <span className="text-sm font-medium w-16 shrink-0">{d.full}</span>

            {/* Time fields — always visible */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Entrada</span>
                <Input
                  type="time"
                  value={s.start}
                  disabled={!s.active}
                  onChange={(e) =>
                    onChange({ ...map, [d.key]: { ...s, start: e.target.value } })
                  }
                  className="w-28 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Saída</span>
                <Input
                  type="time"
                  value={s.end}
                  disabled={!s.active}
                  onChange={(e) =>
                    onChange({ ...map, [d.key]: { ...s, end: e.target.value } })
                  }
                  className="w-28 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Intervalo</span>
                <Input
                  type="time"
                  value={s.break}
                  disabled={!s.active}
                  onChange={(e) =>
                    onChange({ ...map, [d.key]: { ...s, break: e.target.value } })
                  }
                  className="w-28 h-8 text-sm"
                />
              </div>
              {s.active && s.start && s.end && s.end <= s.start && (
                <span className="text-xs text-destructive">Saída deve ser após entrada</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function ScheduleEditor({
  value,
  onChange,
  mode = "inline",
}: {
  value: string;
  onChange: (v: string) => void;
  mode?: "inline" | "modal";
}) {
  const [map, setMap] = useState<ScheduleMap>(() => value ? parse(value) : defaultMap());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleMap>(map);

  useEffect(() => {
    const parsed = value ? parse(value) : defaultMap();
    setMap(parsed);
  }, [value]);

  const preview = useMemo(() => serialize(map), [map]);

  if (mode === "inline") {
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <ScheduleGrid
          map={map}
          onChange={(next) => {
            setMap(next);
            onChange(serialize(next));
          }}
        />
        {preview && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span className="font-medium">Resumo:</span> {preview}
          </div>
        )}
      </div>
    );
  }

  // Modal mode
  return (
    <>
      {/* Trigger row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border px-3 py-2 text-sm min-h-9 flex items-center text-muted-foreground">
          {preview || "Nenhum horário definido"}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(map);
            setOpen(true);
          }}
        >
          <CalendarClock className="h-4 w-4 mr-1" />
          {preview ? "Editar" : "Definir"}
        </Button>
      </div>

      {/* Inner dialog — onPointerDownOutside + onInteractOutside prevent closing outer dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Horários / Escala</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            <ScheduleGrid map={draft} onChange={setDraft} />
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMap(draft);
                onChange(serialize(draft));
                setOpen(false);
              }}
            >
              Salvar escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
