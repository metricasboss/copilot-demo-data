# copilot-demo-data

Gerador determinístico de uma **loja simulada** para a *Conta demo* do Analytics Copilot:
Magento, GA4, Google Ads, Search Console, TikTok Ads e um MMM mínimo (com orgânico e marca),
tudo saindo da mesma simulação, então os números batem entre as fontes.

## Ideia central

Os dados do dia D são `f(seed, D)`. Nada é "baixado e fica velho": quem consome gera até ontem.

- **Mesmo gerador, dois destinos**
  - **BigQuery** (fase 1): job diário acrescenta ontem no projeto `copilot-demo`. Usado em demos
    e pelo comercial via `gmp bq`, com a dimensão de custo (bytes escaneados) visível.
  - **DuckDB local** (fase 4): o sidecar do app gera a janela na abertura. Onboarding sem GCP, sem login, offline.
- **Calendário real**: sazonalidade vem de `src/calendar.ts` (Black Friday, Dia das Mães, Natal...).
- **Verdade conhecida**: os coeficientes do MMM são nossos, então dá para medir se o Copilot os recupera.
- **Armadilhas plantadas** em datas relativas a "hoje" (ver `docs/CENARIOS.md`).
- **PII falsa de propósito**: clientes brasileiros fictícios (nome, CPF, CEP, celular) para mostrar a
  fronteira de PII funcionando ao vivo.

## Status

`simulateDay` funciona para o cenário mínimo: pedidos Magento (pedidos, itens, estornos), eventos GA4
(`session_start`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`), Google Ads (3 campanhas),
catálogo e uma tabela de **verdade conhecida** por canal. Armadilha implementada: **A1** (`purchase` duplicado
nos últimos 12 dias). Ainda **não** existem Search Console, TikTok, MMM, schemas do BigQuery nem as demais armadilhas.

Volume padrão (`--scale 1`): ~5 mil sessões/dia, ~120 pedidos/dia, ~11 mil linhas de GA4/dia.
90 dias = ~1 milhão de linhas de GA4 (~120 MB de CSV). Para algo que caiba em um chat, use `--scale 0.2`.

## Rodar

```bash
npm install
npm test
npm run typecheck

# 90 dias em CSV, um arquivo por tabela (ex.: para importar no app)
node src/cli.ts --from 2026-08-25 --to 2026-11-22 --format csv --merge true --out out --scale 0.2
```

## Docs

- `docs/ARQUITETURA.md`: modelo causal, mapeamento por fonte, custo no GCP.
- `docs/CENARIOS.md`: armadilhas plantadas e verdade do MMM.
- `docs/OPERACAO.md`: como configurar e operar a pipeline diária (GitHub Actions + BigQuery).
- `docs/ROTEIRO.md`: perguntas da demo (rascunho).

## Segurança

Nada de dado real de cliente entra aqui. O projeto GCP demo recebe só `dataViewer` no dataset,
sem `bigquery.jobs.create` para terceiros, para ninguém gerar custo na nossa conta.
