# Cenários e armadilhas

Todas em datas **relativas a hoje**, para a demo sempre ter um problema recente a encontrar.

| Id | Armadilha | Quando | O que o Copilot deve achar |
|---|---|---|---|
| A1 ✅ | Evento `purchase` duplicado no GA4 | hoje − 12 até ontem (implementado) | Receita do GA4 ~2× a do Magento; `transaction_id` repetido. |
| A2 | Campanha sem UTM | hoje − 30 a hoje − 15 | Sessões pagas caindo em `direct`; ROAS do Ads parece pior no GA4. |
| A3 | Tag parou de disparar após deploy | hoje − 9 | Queda de `add_to_cart` sem queda de pedidos no Magento. |
| A4 | Ruptura de estoque no produto líder | hoje − 6 a hoje − 3 | Queda de receita que não é de mídia. |
| A5 | Pico de Black Friday | calendário real | Efeito sazonal separado do efeito de mídia no MMM. |

## Verdade do MMM

Os coeficientes por canal (contribuição, meia-vida do adstock, ponto de saturação) ficam num arquivo
versionado e são parte do contrato do pacote. A demo compara a estimativa do Copilot com esse valor.
Valores a definir na fase 2.

## Armadilhas de PII

Clientes fictícios brasileiros com nome, CPF, CEP e celular em formatos variados (com e sem pontuação),
para exercitar a fronteira de PII.

## Determinismo e armadilhas

O dia D é `f(seed, D)`, exceto pelas armadilhas, que dependem de "hoje" (`SimOptions.today`).
Por isso regerar um dia antigo depois de uns dias pode mudar só o efeito das armadilhas, nunca o resto.
