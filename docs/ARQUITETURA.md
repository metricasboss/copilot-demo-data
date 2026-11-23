# Arquitetura

## Modelo causal (uma simulação, várias fontes)

```
demandFactor(data)            (calendar.ts: semana + eventos comerciais)
  × base orgânica + marca     (SEO, direto, e-mail; branding com adstock longo)
  + mídia paga por canal      (gasto → impressões → cliques, com adstock e saturação)
        │
        ▼
     sessões (por canal, UTM/gclid)  ──►  GA4 events_*
        │
        ▼
     carrinhos → pedidos (taxa por canal e dispositivo, cupom, frete, devolução)  ──►  Magento
```

Chaves que ligam as fontes: `gclid`/UTM → `client_id` (GA4) → `transaction_id` = `increment_id` do pedido Magento.

Determinismo: tudo que sorteia usa `rngFor(seed, data, canal, ...)`. Estado entre dias (adstock) é
calculado a partir de uma **data âncora fixa**, não da janela pedida, para o dia D ser sempre igual.

## Mapeamento por fonte

| Fonte | Formato | Observação |
|---|---|---|
| Magento | Tabelas no formato da API REST (`orders`, `products`, `customers`, `creditmemos`, `salesrule`) | Não há conector Magento no app hoje; fase 1 é só leitura via BigQuery. |
| GA4 | Schema do export (`events_YYYYMMDD`) | Particionado por dia. Compatível com `gmp bq`. |
| Google Ads | Schema do Data Transfer (`ads_Campaign`, `ads_CampaignBasicStats`) | Search marca, search genérico, PMax, Shopping. |
| Search Console | Bulk export (`searchdata_url_impression`) | Representa orgânico e visibilidade de marca. |
| TikTok Ads | Convenção nossa, no formato do Reporting API | Não existe export nativo para BigQuery. |
| GTM | JSON de container | Configuração, não volume. Serve para auditoria de tags. |
| MMM | Tabela diária: gasto por canal + orgânico + marca + resultado | Coeficientes verdadeiros publicados em `docs/CENARIOS.md`. |

## BigQuery e custo

- Projeto `copilot-demo`, dataset público de leitura (`dataViewer`). Quem consulta paga com o próprio projeto.
- Carga via **load jobs** (gratuitos), não streaming insert.
- Tabelas particionadas por dia, com expiração (ex.: 400 dias).
- Budget com alerta e cota diária de bytes no projeto.
- Para a demo de custo ficar visível, a tabela de eventos precisa de volume (dezenas a centenas de milhões de linhas).

## Lacuna conhecida no `gmp-cli` (v1.3.0)

`gmp bq` chama `jobs.query` só com `query`, `useLegacySql` e `maxResults` (`src/commands/bq/shared.ts`).
Não expõe `dryRun`, `totalBytesProcessed` nem `maximumBytesBilled`. O painel de custo da demo depende de
um PR no `gmp-cli` (flags `--dry-run` e `--max-bytes`, e `bytesProcessed` na saída).

## Fases

1. Cenário mínimo (Magento + GA4 + Ads, uma armadilha) escrevendo no BigQuery.
2. Search Console, TikTok, orgânico/marca e MMM com verdade conhecida.
3. Mock HTTP do Magento/TikTok e conector, se a demo pedir.
4. Mesmo gerador em DuckDB no sidecar, para o onboarding.
