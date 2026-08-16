# GENESIS LLA V10.2 — revisão auditada

Protótipo acadêmico do GENESIS para Leucemia Linfoblástica Aguda (LLA).

## Fluxo simplificado

- **Cadastros**: cadastro local simples de pacientes e profissionais; não executa prognóstico.
- **Resultados**: escolhe/carrega o estudo, atualiza o Top 10 a partir do Top 30 mutacional da coorte ativa, permite selecionar genes e gerar somente os gráficos solicitados.
- **Dashboard**: histórico dos gráficos solicitados; não executa análises automaticamente.
- **Sobre o Projeto**: objetivo, autores, limites e regra de validação.
- A rota antiga **Bioinformática** redireciona para Resultados.

## Regra de validação

- **Validado contra R**: somente quando estudo/coorte, filtros, transformação, gene(s), endpoint e valores numéricos foram confrontados com a saída R correspondente.
- **Exploratório local**: cálculo feito no navegador e ainda não confrontado com a execução R correspondente.
- O Top 30 TARGET ALL `n=150` incorporado ao site reproduz os percentuais visíveis na figura R fornecida, na mesma precisão exibida.

## Correções científicas da V10.2

- Kaplan-Meier usa um único endpoint por coorte, seguindo a mesma prioridade de colunas do `Script.R` corrigido.
- Corrigido o teste log-rank local: a implementação anterior superestimava o qui-quadrado em dois grupos.
- Corrigido o IC log-log de Kaplan-Meier.
- Adicionados marcadores de censura e tabela de número em risco.
- Cox local foi testado numericamente contra uma implementação independente (Efron) em dados sintéticos; permanece exploratório até comparação com o R da coorte real.
- FDR do Cox é explicitamente calculado apenas entre os genes selecionados naquela execução.
- DEA/Volcano são bloqueados no modo **Expresso**, pois um painel parcial altera o universo de testes e o FDR. Para habilitá-los, o estudo deve ser carregado em escopo **Completo**.
- Mesmo no escopo completo, a DEA local não é rotulada como `limma`: a validação final depende da tabela produzida pelo R corrigido.
- O Volcano legado com logFC em escala de milhares não é aceito como `log2FC` válido.

## Segurança científica

O GENESIS é um protótipo de pesquisa/educação. Não é dispositivo médico validado, não emite diagnóstico, não recomenda tratamento e não converte curvas de coorte em probabilidade individual de morte ou sobrevida.
