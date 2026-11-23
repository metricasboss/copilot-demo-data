#!/usr/bin/env bash
# TORNA O DATASET PÚBLICO: qualquer pessoa com conta Google passa a poder LER (dataViewer).
# Rode só quando os dados estiverem prontos para mostrar. Reversível com --revoke.
#
# Quem consulta paga o processamento no PRÓPRIO projeto. Este script NÃO concede
# bigquery.jobs.create a ninguém, então ninguém consegue gerar custo no projeto demo.
#
# Uso:  PROJECT_ID=meu-projeto ./infra/publish-dataset.sh [--revoke]
set -euo pipefail

: "${PROJECT_ID:?defina PROJECT_ID}"
DATASET="${DATASET:-demo_store}"
TARGET="${PROJECT_ID}:${DATASET}"

if [ "${1:-}" = "--revoke" ]; then
  bq --project_id="$PROJECT_ID" remove-iam-policy-binding \
    --member="allAuthenticatedUsers" --role="roles/bigquery.dataViewer" "$TARGET"
  echo "Dataset ${TARGET} voltou a ser privado."
  exit 0
fi

read -r -p "Tornar ${TARGET} legível por qualquer conta Google? Digite 'publicar': " ok
[ "$ok" = "publicar" ] || { echo "Cancelado."; exit 1; }

bq --project_id="$PROJECT_ID" add-iam-policy-binding \
  --member="allAuthenticatedUsers" --role="roles/bigquery.dataViewer" "$TARGET"
echo "Público: ${TARGET}. Consulta de exemplo:"
echo "  gmp bq explore --project SEU_PROJETO --dataset ${PROJECT_ID}.${DATASET}"
