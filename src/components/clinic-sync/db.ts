// Cliente Supabase compartilhado do app principal, exposto de forma "solta" para
// o módulo Clinic Sync. As tabelas cs_* ainda não estão no types.ts gerado
// (serão adicionadas quando regenerarmos os tipos após aplicar as migrations),
// então usamos um cast para não travar o type-check. Trocar por
// "@/integrations/supabase/client" tipado quando os tipos forem regenerados.
import { supabase as typedClient } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedClient as any;
