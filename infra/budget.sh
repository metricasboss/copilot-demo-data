#!/usr/bin/env bash
# Cria um alerta de orçamento para o projeto demo. Rode DEPOIS do setup.sh.
#
# Uso:  PROJECT_ID=meu-projeto BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX ./infra/budget.sh
# (BILLING_ACCOUNT: gcloud billing accounts list)
# Orçamento só avisa, não corta o gasto. O corte real é não dar `bigquery.jobs.create` a ninguém.
set -euo pipefail

: "${PROJECT_ID:?defina PROJECT_ID}"
: "${BILLING_ACCOUNT:?defina BILLING_ACCOUNT (gcloud billing accounts list)}"
AMOUNT="${AMOUNT:-20USD}"

gcloud services enable billingbudgets.googleapis.com --project="$PROJECT_ID"
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="copilot-demo (${PROJECT_ID})" \
  --budget-amount="$AMOUNT" \
  --filter-projects="projects/${PROJECT_ID}" \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0

echo "Orçamento de ${AMOUNT}/mês criado, com alertas em 50%, 90% e 100%."
