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

Esqueleto. Existe o PRNG determinístico e o calendário comercial, com testes.
Ainda **não** existe `simulateDay`, nem exporters, nem job de BigQuery.

## Rodar

```bash
npm install
npm test
npm run typecheck
```

## Docs

- `docs/ARQUITETURA.md`: modelo causal, mapeamento por fonte, custo no GCP.
- `docs/CENARIOS.md`: armadilhas plantadas e verdade do MMM.
- `docs/OPERACAO.md`: como configurar e operar a pipeline diária (GitHub Actions + BigQuery).
- `docs/ROTEIRO.md`: perguntas da demo (rascunho).

## Segurança

Nada de dado real de cliente entra aqui. O projeto GCP demo recebe só `dataViewer` no dataset,
sem `bigquery.jobs.create` para terceiros, para ninguém gerar custo na nossa conta.
