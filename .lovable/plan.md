# Plano — Fluxo completo de relatórios por profissional

## Status (novo enum)
`rascunho` → `em_revisao` → **`encaminhado_diretoria`** → `aprovado_diretoria` (liberado p/ assinatura) → **`assinado`** (todos assinaram) → `liberado_pais` (pronto p/ imprimir)

## Migration
- `ALTER TYPE report_status ADD VALUE 'encaminhado_diretoria' BEFORE 'aprovado_diretoria'`
- `ALTER TYPE report_status ADD VALUE 'assinado' BEFORE 'liberado_pais'`
- Substitui `reports_update_creator_or_admin` por policy que também permite UPDATE quando o usuário é profissional de qualquer seção do relatório (para encaminhar).

## /reports (lista) — profissional
- Mostra somente relatórios dos **pacientes da grade dele** (`therapy_grid.professional_id = myProfessional.id`).
- Junto da lista, **lista de pacientes pendentes** (pacientes da grade que ainda não têm relatório no período aberto) — clicando cria/abre o relatório.
- Botão **"Encaminhar para Diretoria"** quando status ∈ {rascunho, em_revisao} e a parte dele está preenchida.
- Botão **"Consultar relatórios"** → modal lista relatórios dos mesmos pacientes (somente leitura).

## /reports/$id — preenchimento
- Profissional vê: a seção dele (editável) **e** seções dos colegas (read-only — já existe a UI, só falta deixar de filtrar).
- Aviso visual "modo leitura nas áreas de colegas".
- Após `aprovado_diretoria`: aparece botão **"Assinar com meu carimbo"** para cada profissional listado em `report_signers` cujo `professional.user_id = auth.uid()`. Grava `signed_at`, `signed_by`, copia `professionals.stamp_url` em `signature_url`.
- Quando todos os signers estão assinados → status muda para `assinado` automaticamente.

## /impressoes — Diretoria
- Sem alterar o gate (continua só RT/Diretoria).
- Novo filtro: **"Aguardando análise"** (`encaminhado_diretoria`).
- Botão **"Liberar para assinatura"** (status → `aprovado_diretoria`) e **"Liberar para impressão"** (status → `liberado_pais`, só após `assinado`).
- Layout de impressão melhorado com **logotipo** no cabeçalho.

## /dashboard
- Profissional vê só **seus** pacientes/grade. Diretoria/RT continua vendo tudo.

## Arquivos
- `src/routes/_authenticated/reports.tsx`
- `src/routes/_authenticated/reports/$reportId.tsx`
- `src/routes/_authenticated/reports/$reportId.print.tsx`
- `src/routes/_authenticated/impressoes.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/signatures.tsx` (botão Assinar)
