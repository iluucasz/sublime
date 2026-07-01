// Cliente Supabase compartilhado do app principal, exposto de forma "solta" para
// o módulo Dia a Dia (tabelas dd_* ainda não estão no types.ts gerado).
// Trocar por "@/integrations/supabase/client" tipado quando os tipos forem regenerados.
import { supabase as typedClient } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedClient as any;
