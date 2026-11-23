# Operação da pipeline diária

Roda no GitHub Actions (`.github/workflows/daily-load.yml`), todo dia às 05:17 UTC:
gera o dia anterior e carrega no BigQuery com `bq load --replace` (gratuito, idempotente).

## Configurar do zero

Pré-requisitos: um projeto GCP com faturamento ativo, `gcloud` e `bq` logados como dono do projeto.

1. **Infra** (cria dataset, service account, Workload Identity Federation restrita a este repo, branch `main`):
   ```bash
   PROJECT_ID=<seu-projeto> ./infra/setup.sh
   ```
   O script imprime os quatro valores das variáveis do repositório.
2. **Variáveis no GitHub** (`gh variable set ...`, o script mostra os comandos prontos). Não há segredos:
   a autenticação é por federação, sem chave JSON.
3. **Orçamento** (recomendado):
   ```bash
   PROJECT_ID=<seu-projeto> BILLING_ACCOUNT=<id> ./infra/budget.sh
   ```
4. **Teste sem carregar**: Actions > daily-load > Run workflow, com `dry_run` marcado.
   Antes de `DEMO_PIPELINE_ENABLED=true` o job é pulado; para o dry-run, defina a variável.
5. **Backfill**: Run workflow com `from`/`to` (máx. 800 dias).
6. **Ligar o agendamento**: `DEMO_PIPELINE_ENABLED=true`.
7. **Abrir ao público** (só quando houver dados bons): `PROJECT_ID=... ./infra/publish-dataset.sh`.

## O que está pronto e o que não está

| Peça | Estado |
|---|---|
| Workflow, CLI, manifesto, carregador `bq load`, scripts de infra | Escritos. Os scripts de infra e o carregador **não foram executados contra um GCP real**. |
| `simulateDay` | **Não implementado** (lança erro). Por isso o agendamento não deve ser ligado ainda. |
| Schemas em `bq/schemas/` | Ainda não existem; chegam junto com cada exporter. |

Primeira execução real: começar pelo `dry_run`, depois um único dia, conferir no console do BigQuery,
e só então ligar o agendamento.

## Segurança

- A identidade do GitHub só funciona para `metricasboss/copilot-demo-data` na branch `main`
  (`--attribute-condition` em `infra/setup.sh`). Um fork não consegue assumi-la.
- O workflow só roda em `schedule` e `workflow_dispatch`, nunca em `pull_request`, então código de PR de fora não toca no GCP.
- O dataset público dá só `dataViewer`. Ninguém recebe `bigquery.jobs.create` no projeto demo.
- Tabelas expiram em 400 dias por padrão, para o armazenamento não crescer sem limite.

## Pontos a verificar na primeira execução

- Se `bq load` em `tabela$AAAAMMDD` cria a tabela particionada quando ela ainda não existe
  (o carregador passa `--time_partitioning_type=DAY` por precaução).
- Se o passo `keepalive` realmente evita a desativação do agendamento após ~60 dias sem atividade.
- O horário do `cron` pode atrasar dezenas de minutos; para dado diário não importa.
