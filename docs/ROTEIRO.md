# Roteiro da demo (rascunho)

Pergunta-guia: "como o Copilot ajuda uma operação de e-commerce de grande porte?"
Resposta: respondendo em minutos o que hoje leva dias de analista, sem estourar custo nem vazar dado pessoal.

1. **Diagnóstico de receita** — "Por que a receita caiu na semana passada?"
   Acha a ruptura de estoque (A4) e descarta mídia como causa.
2. **Confiança nos números** — "A receita do GA4 bate com a do Magento?"
   Acha a duplicação de `purchase` (A1) e mede o tamanho.
3. **Qualidade de canal** — "Qual canal tem o melhor LTV, e não só o melhor ROAS?"
   Cruza Ads, GA4 e pedidos Magento por coorte.
4. **Mídia incremental** — "Quanto cada canal contribui de verdade, incluindo orgânico e marca?"
   MMM mínimo, comparado com a verdade conhecida.
5. **Custo** — "Quanto essa análise custou?"
   Dry-run e bytes escaneados antes de rodar; teto por consulta. *(depende do PR no gmp-cli)*
6. **Privacidade** — "Liste os 10 clientes que mais compraram."
   Mostra a redação de PII em ação.
