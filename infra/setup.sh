#!/usr/bin/env bash
# Cria no GCP o necessário para a pipeline diária: dataset, service account e
# Workload Identity Federation restrita a este repositório. NÃO abre o dataset ao público
# (isso é infra/publish-dataset.sh, separado de propósito).
#
# Uso:  PROJECT_ID=meu-projeto ./infra/setup.sh
# Requer: gcloud e bq autenticados (gcloud auth login) com permissão de dono no projeto.
# Idempotente na maior parte: rodar de novo ignora o que já existe.
set -euo pipefail

: "${PROJECT_ID:?defina PROJECT_ID}"
GH_REPO="${GH_REPO:-metricasboss/copilot-demo-data}"
DATASET="${DATASET:-demo_store}"
LOCATION="${LOCATION:-US}"          # os datasets públicos do Google ficam em US; manter igual
EXPIRATION_DAYS="${EXPIRATION_DAYS:-400}"
SA_NAME="demo-loader"
POOL="github"
PROVIDER="github-oidc"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "==> APIs"
gcloud services enable bigquery.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

echo "==> Dataset ${DATASET} (${LOCATION}, expiração padrão de tabelas: ${EXPIRATION_DAYS} dias)"
if ! bq --project_id="$PROJECT_ID" show --dataset "${PROJECT_ID}:${DATASET}" >/dev/null 2>&1; then
  bq --project_id="$PROJECT_ID" mk --dataset \
    --location="$LOCATION" \
    --default_table_expiration="$((EXPIRATION_DAYS * 86400))" \
    --description="Dados simulados do Analytics Copilot (Conta demo). Nada aqui é dado real." \
    "${PROJECT_ID}:${DATASET}"
fi

echo "==> Service account ${SA_EMAIL}"
gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --display-name="Carga diária da Conta demo"

# jobUser no projeto (para criar load jobs) + dataEditor SÓ no dataset.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/bigquery.jobUser" --condition=None >/dev/null
bq --project_id="$PROJECT_ID" add-iam-policy-binding \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/bigquery.dataEditor" \
  "${PROJECT_ID}:${DATASET}" >/dev/null

echo "==> Workload Identity Federation (sem chave JSON)"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"

# A condição abaixo é o que impede um fork ou outra branch de assumir esta identidade.
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GH_REPO}' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GH_REPO}" >/dev/null

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

cat <<EOF

Pronto. Configure no GitHub (Settings > Secrets and variables > Actions > Variables) em ${GH_REPO}:

  GCP_PROJECT          = ${PROJECT_ID}
  BQ_DATASET           = ${DATASET}
  GCP_SERVICE_ACCOUNT  = ${SA_EMAIL}
  GCP_WIF_PROVIDER     = ${WIF_PROVIDER}
  DEMO_PIPELINE_ENABLED = true        (só depois do primeiro dry-run dar certo)

Ou, com o gh logado como você:

  gh variable set GCP_PROJECT --repo ${GH_REPO} --body "${PROJECT_ID}"
  gh variable set BQ_DATASET --repo ${GH_REPO} --body "${DATASET}"
  gh variable set GCP_SERVICE_ACCOUNT --repo ${GH_REPO} --body "${SA_EMAIL}"
  gh variable set GCP_WIF_PROVIDER --repo ${GH_REPO} --body "${WIF_PROVIDER}"
EOF
