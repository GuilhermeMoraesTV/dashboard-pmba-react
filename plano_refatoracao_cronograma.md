# Plano de Refatoração — Sistema de Cronograma MODOQAP
### Guia Completo de Prompts — Passo a Passo por Fase

> **Como usar este guia:**
> - Cada fase é uma conversa separada no Claude (plano gratuito consegue lidar com cada fase individualmente)
> - Antes de cada prompt, você verá quais arquivos precisa enviar
> - Os prompts estão prontos para copiar e colar — só substitua os trechos entre `[ ]`
> - Sempre salve o arquivo gerado antes de passar para a próxima etapa
> - Nunca pule uma fase — cada uma depende da anterior

---

## VISÃO GERAL DAS FASES

| Fase | O que você vai criar | Arquivos que envia | Dificuldade |
|------|----------------------|---------------------|-------------|
| **1** | `scheduling/core.js` — funções matemáticas puras | `cronogramaAlocacao.js` + `useCronogramaSystem.js` + `cronogramaIA.js` | Fácil |
| **2** | `scheduling/index.js` — serviço de geração unificado | `core.js` gerado + `cronogramaIA.js` | Médio |
| **3** | `scheduling/review.js` + hook simplificado | `useCronogramaSystem.js` + `index.js` gerado | Médio |
| **4** | `useCronogramaWizard.js` + `WizardShell.jsx` | `index.jsx` + hook gerado | Difícil |
| **5** | Steps presentacionais + limpeza final | Todos os `Step*.jsx` | Fácil |

---

---

# FASE 1 — Consolidar Funções Matemáticas Puras

**Objetivo:** Criar um único arquivo `scheduling/core.js` com todas as funções de cálculo, eliminando as cópias duplicadas espalhadas por 3 arquivos diferentes.

**Por que começar aqui:** É a camada mais simples, sem React, sem Firebase, sem IA. Dá pra testar e validar isoladamente.

**O que você vai eliminar:** `arredondar5` duplicada em 2 lugares, `calcularCotasSemanais` repetida, constantes espalhadas.

---

### Passo 1.1 — Análise inicial

**Arquivos para enviar:** `cronogramaAlocacao.js` + `useCronogramaSystem.js` + `cronogramaIA.js`

**Prompt:**

```
Vou refatorar meu sistema de cronograma de estudos (MODOQAP). Esta é a Fase 1: consolidar funções matemáticas puras.

Analise os 3 arquivos anexados e me diga:
1. Quais funções são puramente matemáticas (sem deps React, sem Firebase, sem fetch)?
2. Quais funções estão duplicadas entre os arquivos (mesmo nome ou mesma lógica)?
3. Quais constantes estão definidas em mais de um lugar (ex: BASE_CAP_REVISAO, arredondar5)?
4. Existe alguma dependência circular entre essas funções puras?

Não escreva código ainda. Só liste o inventário.
```

---

### Passo 1.2 — Criar core.js

**Arquivos para enviar:** os mesmos 3 arquivos do passo anterior

**Prompt:**

```
Com base na análise anterior, crie o arquivo src/services/scheduling/core.js.

Regras:
- Mova para este arquivo TODAS as funções puras identificadas: normalizarNivel, calcularPesoComAssuntos, calcularMediaAssuntosPorNivel, distribuirSlotsPorPeso, distribuirMinutosPorPeso, calcularMateriasPorDia, arredondar5, calcularTetoElastico, calcularCotasSemanais
- As constantes BASE_CAP_REVISAO, MAX_CAP_REVISAO, INTERVALOS_REVISAO também ficam aqui
- Se uma função existia em mais de um arquivo com implementações levemente diferentes, unifique escolhendo a versão mais recente/completa e adicione um comentário explicando qual era a origem
- Nenhum import de React, Firebase, ou fetch neste arquivo
- Exporte tudo com named exports (export function, export const)
- Adicione JSDoc em cada função com: @param, @returns e uma linha de descrição

Entregue o arquivo completo e pronto para uso.
```

---

### Passo 1.3 — Criar shim de compatibilidade

**Arquivo para enviar:** o `core.js` gerado no passo anterior + `cronogramaAlocacao.js` original

**Prompt:**

```
Agora preciso garantir compatibilidade reversa. 

Reescreva o cronogramaAlocacao.js para que ele apenas re-exporte tudo de scheduling/core.js, sem duplicar nenhuma implementação. Assim qualquer arquivo que importava de cronogramaAlocacao.js continua funcionando sem precisar ser alterado agora.

Formato esperado:
// cronogramaAlocacao.js — shim de compatibilidade (pode remover após migração completa)
export { funcao1, funcao2, CONSTANTE1 } from './services/scheduling/core.js'

Liste também quais outros arquivos importam de cronogramaAlocacao.js e que precisarão ser atualizados nas fases seguintes.
```

---

### Passo 1.4 — Verificar integridade matemática

**Arquivo para enviar:** o `core.js` gerado

**Prompt:**

```
Revise o arquivo core.js com foco em integridade matemática.

Verifique especificamente:
1. A função distribuirMinutosPorPeso (ou equivalente): para qualquer entrada válida, a soma dos valores de saída deve ser igual ao totalMinutos de entrada. Confirme que isso é verdade ou corrija.
2. A função arredondar5: identifique se é chamada dentro de distribuirMinutosPorPeso ou fora. Se for chamada dentro, o arredondamento vai acumular erro. A solução correta é NÃO chamar arredondar5 dentro de funções de distribuição — ela deve ser chamada apenas no momento de montar o slot final.
3. distribuirSlotsPorPeso: a soma dos slots deve ser igual ao totalSlots. Confirme.

Se encontrar problemas, corrija e entregue o core.js revisado completo.
```

---

**✅ Critério de conclusão da Fase 1:**
- `core.js` existe em `src/services/scheduling/`
- Nenhuma função pura está duplicada nos outros arquivos
- `cronogramaAlocacao.js` apenas re-exporta
- Você consegue olhar `core.js` e entender o que cada função faz

---

---

# FASE 2 — Criar Serviço de Geração Unificado

**Objetivo:** Criar `scheduling/index.js` com uma única função `gerarSchedule()` que substitui os dois geradores paralelos (`gerarCronogramaIA` e `gerarSemanaTemplate`).

**Por que esta é a fase mais importante:** Aqui eliminamos o bug recorrente de desvio de minutos, as 4 funções corretivas (`corrigirHierarquiaTempo`, `corrigirDiasMono`, `ajustarMinutosParaCotas`, `normalizarRespostaIA`) e o terceiro caminho de fallback no index.jsx.

---

### Passo 2.1 — Entender o pipeline atual

**Arquivos para enviar:** `cronogramaIA.js` + `useCronogramaSystem.js`

**Prompt:**

```
Analise os dois arquivos e mapeie os dois pipelines de geração de cronograma que existem em paralelo.

Para cada pipeline, liste em ordem:
1. Nome da função de entrada
2. Cada função chamada em sequência, com uma linha explicando o que transforma
3. Formato exato da saída (estrutura do objeto semanaTemplate)
4. Quais invariantes cada pipeline tenta garantir (ex: diversidade de disciplinas por dia, soma de minutos)

Depois compare os dois pipelines e liste: o que é idêntico, o que é diferente, e qual implementação é mais correta em cada ponto de diferença.

Não escreva código novo ainda.
```

---

### Passo 2.2 — Criar scheduling/index.js

**Arquivos para enviar:** `core.js` gerado na Fase 1 + `cronogramaIA.js` + `useCronogramaSystem.js`

**Prompt:**

```
Crie o arquivo src/services/scheduling/index.js com a função principal gerarSchedule().

Contexto: estou unificando dois geradores paralelos em um único pipeline determinístico.

A função deve seguir exatamente esta sequência:

PASSO 1 — calcularPesos(disciplinas): usa calcularPesoComAssuntos de core.js
PASSO 2 — calcular totalMinutos e totalSlots a partir de disponibilidade (horas por dia)
PASSO 3 — distribuirProporcionalmente com método Hamilton (sem arredondamento intermediário) para slots e minutos por disciplina. Importar de core.js
PASSO 4 — para cada dia, selecionar disciplinas garantindo diversidade (mínimo 2 disciplinas se ciclo >= 2). Gerar array de slots com { dia, disciplinaId, ordem }
PASSO 5 — atribuir minutosEstudo a cada slot. arredondar5() chamado UMA ÚNICA VEZ aqui, em nenhum outro passo. Usar método Hamilton dentro de cada disciplina para distribuir os minutos entre seus slots
PASSO 6 — atribuir assuntos a cada slot pelo índice circular

Regras de implementação:
- Importar tudo de './core.js', não reimplementar nada
- A soma de minutos de todos os slots deve ser exatamente igual ao totalMinutos (validar com throw se divergir mais de 5 min)
- NÃO criar corrigirHierarquiaTempo, corrigirDiasMono, ajustarMinutosParaCotas — os invariantes devem ser garantidos na geração, não corrigidos depois
- Criar também gerarScheduleFallback() como alias de gerarSchedule() para compatibilidade

Assinatura:
export function gerarSchedule(disciplinas, disponibilidade, opcoes = {})
// opcoes: { nomeEstudo, dataInicio, dataFim, metodologiaRevisao }
// retorna: { slots: SlotTemplate[], meta: { distribuicao, totalSemanas, totalMinutosSemana } }

Entregue o arquivo completo.
```

---

### Passo 2.3 — Criar aiAdapter.js

**Arquivo para enviar:** o trecho de `cronogramaIA.js` que faz a chamada ao Gemini (pode copiar só a parte da chamada REST e do prompt)

**Prompt:**

```
Crie o arquivo src/services/scheduling/aiAdapter.js que encapsula a comunicação com o Gemini.

Contexto: a IA é um otimizador OPCIONAL. Se a chamada falhar ou retornar formato inválido, o sistema usa gerarSchedule() do index.js normalmente. A IA só melhora a distribuição de assuntos entre slots — ela não altera a estrutura do template nem os minutos.

O arquivo deve exportar:
- async function otimizarComIA(slots, disciplinas, opcoes): recebe o template já gerado pelo algoritmo local, envia para o Gemini pedir uma reordenação de assuntos mais estratégica, valida o schema da resposta, e retorna os slots com assuntos otimizados OU os slots originais se a IA falhar
- function validarRespostaIA(resposta): retorna true/false se a resposta tem o schema esperado

Extraia do arquivo que enviei:
- A URL da chamada REST ao Gemini
- O formato do SYSTEM_PROMPT (mas simplifique: a IA só precisa reordenar assuntos, não gerar minutos)
- A lógica de extrairJSON() para lidar com markdown wrapping

O adapter NUNCA deve lançar exceção — sempre retorna os slots originais como fallback.
```

---

### Passo 2.4 — Wrapper de compatibilidade para gerarCronogramaIA

**Arquivos para enviar:** `cronogramaIA.js` + `index.js` e `aiAdapter.js` gerados

**Prompt:**

```
Preciso manter compatibilidade com o código existente que chama gerarCronogramaIA() do cronogramaIA.js.

Reescreva cronogramaIA.js para que ele seja um wrapper fino que:
1. Recebe os mesmos parâmetros de antes
2. Internamente chama gerarSchedule() de ./services/scheduling/index.js
3. Internamente chama otimizarComIA() de ./services/scheduling/aiAdapter.js (se disponível)
4. Retorna no mesmo formato que o index.jsx espera hoje

Remova do arquivo: corrigirHierarquiaTempo, corrigirDiasMono, ajustarMinutosParaCotas, normalizarRespostaIA, o Map inFlight, calcularCotasSemanais (agora em core.js), gerarEsqueleto (mover para skeleton.js ou inline em index.js).

O arquivo resultante deve ter menos de 100 linhas.
```

---

**✅ Critério de conclusão da Fase 2:**
- `scheduling/index.js` existe com `gerarSchedule()`
- A soma de minutos dos slots é sempre igual ao total configurado
- `cronogramaIA.js` tem menos de 100 linhas e não contém lógica de distribuição
- O sistema ainda funciona — você pode testar abrindo o wizard e gerando um cronograma

---

---

# FASE 3 — Simplificar o Hook useCronogramaSystem

**Objetivo:** Reduzir `useCronogramaSystem.js` de 759 linhas para menos de 200. O hook vira um adaptador fino entre o serviço e o estado React.

**O que sai do hook:** `gerarSemanaTemplate`, `getAgendaSemana`, algoritmos de round-robin, Elastic Cap.

**O que fica no hook:** estado de loading, operações Firebase (toggle, salvar, excluir), funções de data.

---

### Passo 3.1 — Criar scheduling/review.js

**Arquivo para enviar:** a parte de `useCronogramaSystem.js` que contém `getAgendaSemana`, `calcularTetoElastico`, `INTERVALOS_REVISAO`

**Prompt:**

```
Extraia a lógica de revisão espaçada para um arquivo puro: src/services/scheduling/review.js

Este arquivo deve exportar:

1. function getRevisoesParaDia(dataAlvo, historico, assuntosDominados)
   - historico: array de { disciplinaId, assunto, dataEstudo }
   - retorna: array de revisões devidas nesse dia
   - usa INTERVALOS_REVISAO de core.js

2. function getAgendaDia(dia, template, historico, dominados, minutosDisponiveis)
   - retorna: array mesclado de slots de estudo + slots de revisão para o dia
   - aplica Elastic Cap (usa calcularTetoElastico de core.js)
   - consolida revisões quando > 3 no dia

3. function getAgendaSemana(cronograma, weekOffset, historico, dominados)
   - chama getAgendaDia para cada dia da semana

Regras:
- Sem imports de React
- Sem acesso ao Firebase
- Sem referência a state ou props
- Todas as funções devem ser puras (mesmo input → mesmo output)
- Importar constantes de './core.js'
```

---

### Passo 3.2 — Refatorar useCronogramaSystem.js

**Arquivos para enviar:** `useCronogramaSystem.js` original + `review.js` gerado + `index.js` gerado

**Prompt:**

```
Refatore useCronogramaSystem.js para que ele seja apenas um adaptador React.

O hook deve:
- Importar gerarSchedule de ./services/scheduling/index.js
- Importar getAgendaSemana de ./services/scheduling/review.js
- Manter APENAS: estado de loading, funções async de Firebase (toggleSlotConcluido, toggleAssuntoDominado, salvarCronogramaUnificado, excluirCronograma), funções de data utilitárias

Remova do hook:
- gerarSemanaTemplate (substituído por gerarSchedule)
- getAgendaSemana (movido para review.js)
- calcularTetoElastico (movido para core.js)
- INTERVALOS_REVISAO (movido para core.js)
- BASE_CAP_REVISAO, MAX_CAP_REVISAO (movidos para core.js)
- Toda lógica de round-robin e distribuição de peso

O hook deve exportar no máximo 10 itens. Liste o que ficou.

Entregue o arquivo refatorado completo. Deve ter menos de 200 linhas.
```

---

**✅ Critério de conclusão da Fase 3:**
- `useCronogramaSystem.js` tem menos de 200 linhas
- `scheduling/review.js` existe como arquivo puro
- Nenhum algoritmo de distribuição está dentro do hook
- A agenda ainda exibe corretamente (teste navegando por semanas no cronograma ativo)

---

---

# FASE 4 — Refatorar o Orquestrador index.jsx

**Objetivo:** Extrair toda a lógica do `index.jsx` para um hook dedicado `useCronogramaWizard.js`, deixando o componente apenas com navegação e layout.

**Esta é a fase mais delicada** — index.jsx é o coração do wizard e qualquer erro quebra o fluxo de criação do cronograma. Faça em partes.

---

### Passo 4.1 — Mapear o estado do index.jsx

**Arquivo para enviar:** `index.jsx`

**Prompt:**

```
Analise o index.jsx e faça um inventário completo de tudo que ele contém.

Liste em categorias:
1. useState: nome da variável, tipo, valor inicial
2. useRef: nome e propósito
3. useEffect: o que dispara e o que faz
4. Funções internas: nome, o que recebe, o que faz, se tem chamada async
5. O que é passado como prop para cada Step
6. O que é retornado no JSX (layout, componentes de UI)

Identifique quais itens devem ir para useCronogramaWizard.js e quais devem ficar no componente. Regra geral:
- Estado de dados (disciplinas, horários, edital, config) → hook
- Funções de negócio (handleGerarPrevia, handleSalvar, podeAvancar) → hook  
- Estado de UI (passo atual, loading visual, modal aberto) → pode ficar no componente
- Renderização → componente

Não escreva código. Entregue só o mapeamento.
```

---

### Passo 4.2 — Criar useCronogramaWizard.js

**Arquivo para enviar:** `index.jsx` + `useCronogramaSystem.js` refatorado + `scheduling/index.js`

**Prompt:**

```
Crie o hook useCronogramaWizard.js que concentra toda a lógica de estado e negócio do wizard.

O hook deve conter:
- Todo o estado de dados: tipo, edital, disciplinas, horarios, config
- Persistência de rascunho: salvarDraft(), lerDraft(), limparDraft() usando localStorage
- Um único estado para o resultado da geração: resultadoGeracao = null | { slots, meta, semanaTemplate }
  (em vez dos 5 useState separados: semanaTemplateIA, distribuicaoTempoIA, etc.)
- handleGerarPrevia(): chama gerarSchedule() de scheduling/index.js, atualiza resultadoGeracao
- handleSalvar(): chama salvarCronogramaUnificado() do useCronogramaSystem
- podeAvancar(passo): retorna boolean para cada step (lógica de validação que hoje está no index.jsx)
- Sem uso de unstable_batchedUpdates (não é mais necessário com estado unificado)

Extraia do index.jsx original toda a lógica de:
- Carregamento de editais do Firebase (useEffect de inicialização)
- Restauração de rascunho ao montar
- A lógica de podeAvancar por step

Retorne do hook um objeto com: { tipo, edital, disciplinas, horarios, config, passo, resultadoGeracao, setTipo, setEdital, setDisciplinas, setHorarios, setConfig, setPasso, handleGerarPrevia, handleSalvar, podeAvancar, isLoading }

Entregue o arquivo completo.
```

---

### Passo 4.3 — Criar WizardShell.jsx

**Arquivos para enviar:** `index.jsx` original + `useCronogramaWizard.js` gerado

**Prompt:**

```
Reescreva o index.jsx como WizardShell.jsx — componente puramente de layout e navegação.

O componente deve:
- Importar useCronogramaWizard e desestruturar o que precisa
- Renderizar o step atual com base em passo
- Renderizar a barra de progresso e o rodapé de navegação (Voltar / Avançar / Gerar)
- Renderizar modais de confirmação
- NÃO conter nenhuma chamada async direta
- NÃO conter nenhuma lógica de validação de negócio
- NÃO conter nenhuma chamada ao Firebase
- NÃO conter os useEffect de inicialização (eles ficam no hook)

Regras de tamanho: o arquivo deve ter menos de 200 linhas.

Se alguma lógica for difícil de mover para o hook sem quebrar, deixe um comentário // TODO: mover para useCronogramaWizard e mantenha funcionando.

Entregue o arquivo completo.
```

---

**✅ Critério de conclusão da Fase 4:**
- `useCronogramaWizard.js` existe com toda a lógica de negócio
- `WizardShell.jsx` (ex-index.jsx) tem menos de 200 linhas
- O wizard completo ainda funciona: cria, configura e gera cronograma

---

---

# FASE 5 — Steps Presentacionais e Limpeza Final

**Objetivo:** Garantir que nenhum Step importa lógica de negócio, unificar as props do Step5Preview, e remover código de debug da produção.

---

### Passo 5.1 — Auditar imports dos Steps

**Arquivos para enviar:** todos os arquivos `Step*.jsx` (pode enviar em grupos de 3-4 por prompt)

**Prompt (enviar com Steps 0, 1, 2):**

```
Audite estes componentes Step com foco em separação de responsabilidades.

Para cada arquivo, me diga:
1. Quais imports existem além de React, componentes UI (lucide, framer-motion, shadcn) e tipos?
2. O componente faz alguma chamada async? Acessa Firebase? Chama algum serviço?
3. Quais props recebe? Todas as props são dados ou callbacks vindos do pai?
4. O componente tem estado interno (useState)? Se sim, é estado de UI (ex: campo de texto) ou estado de negócio (ex: lista de disciplinas)?

Liste os problemas encontrados e o que deve ser movido para useCronogramaWizard.
```

*Repita este prompt para os grupos: Steps 3, 4, 5 — e depois: StepMetodologiaRevisao, Step1_5*

---

### Passo 5.2 — Corrigir Step5Preview

**Arquivos para enviar:** `Step5Preview.jsx` + `useCronogramaWizard.js` gerado

**Prompt:**

```
Refatore Step5Preview.jsx para receber uma única prop resultado no lugar das props separadas atuais.

O tipo de resultado deve ser:
{
  slots: SlotTemplate[],
  meta: {
    distribuicao: { disciplinaId, nome, minutos, percentual }[],
    totalSemanas: number,
    totalMinutosSemana: number,
    ciclosCompletos: number
  },
  semanaTemplate: any // formato legado para compatibilidade
}

Remova as props individuais: semanaTemplateIA, distribuicaoTempoIA, ciclosCompletosIA, semanasParaCicloIA, totalTopicosEditalIA

Atualize também o WizardShell.jsx para passar resultado={resultadoGeracao} para o Step5Preview em vez das 5 props separadas.

Entregue os dois arquivos atualizados.
```

---

### Passo 5.3 — Remover código de debug

**Arquivos para enviar:** `TestadorAlocacao.jsx` + `WizardShell.jsx` (ou index.jsx)

**Prompt:**

```
Faça a limpeza de código de debug e produção.

1. Mova TestadorAlocacao.jsx para src/devtools/TestadorAlocacao.jsx

2. No WizardShell.jsx (ou index.jsx), envolva qualquer uso de TestadorAlocacao com:
   {import.meta.env.DEV && <TestadorAlocacao ... />}
   Assim ele não aparece em produção.

3. Procure por todas as chamadas de debugLogModoqapPesos ou console.log com prefixo [MODOQAP] nos arquivos de serviço e substitua por:
   if (import.meta.env.DEV) console.log(...)

4. No cronogramaIA.js ou nos arquivos do serviço, remova os comentários de versão [FIX v1] a [FIX v7] — eles são histórico que pertence ao git, não ao código.

Entregue os arquivos modificados.
```

---

### Passo 5.4 — Verificação final da estrutura

**Arquivos para enviar:** todos os arquivos refatorados (pode listar apenas os nomes e conteúdo resumido)

**Prompt:**

```
Faça uma checklist final da refatoração do sistema de cronograma.

Verifique:
[ ] scheduling/core.js existe e não tem imports de React/Firebase
[ ] scheduling/index.js existe com gerarSchedule() exportado
[ ] scheduling/review.js existe com getAgendaSemana como função pura
[ ] scheduling/aiAdapter.js existe e nunca lança exceção
[ ] cronogramaAlocacao.js é apenas um re-export de core.js
[ ] cronogramaIA.js tem menos de 100 linhas
[ ] useCronogramaSystem.js tem menos de 200 linhas e não tem algoritmos de distribuição
[ ] useCronogramaWizard.js existe com toda lógica de estado do wizard
[ ] WizardShell.jsx tem menos de 200 linhas e sem chamadas async
[ ] Step5Preview recebe prop resultado única
[ ] TestadorAlocacao está em devtools/ e protegido por import.meta.env.DEV
[ ] Nenhuma função corretiva pós-geração existe (corrigirHierarquiaTempo, corrigirDiasMono, ajustarMinutosParaCotas)
[ ] arredondar5() é chamada em um único ponto do pipeline

Para cada item que não passou, explique o que ainda precisa ser feito.
```

---

**✅ Critério de conclusão da Fase 5 (e do projeto):**
- Todos os items do checklist marcados
- O wizard funciona end-to-end: criar → configurar → gerar → salvar → visualizar agenda
- Nenhum bug de desvio de minutos reportado

---

---

# DICAS GERAIS PARA O PLANO GRATUITO

**Como dividir arquivos grandes:**
Se um arquivo como `cronogramaIA.js` (1.277 linhas) for grande demais para uma única mensagem, envie em partes:
```
Parte 1/2: linhas 1 a 600 do cronogramaIA.js
[cole o código]
Aguarde minha próxima mensagem com a parte 2.
```

**Como reutilizar contexto entre prompts:**
No início de cada prompt de uma mesma fase, adicione:
```
Contexto: estou na Fase [X] da refatoração do sistema MODOQAP.
Já criei: [lista dos arquivos gerados até agora]
```

**Se o Claude gerar código incompleto:**
```
O arquivo gerado está incompleto. Continue a partir da linha que parou,
mantendo exatamente o mesmo estilo e sem repetir o que já foi escrito.
```

**Se encontrar um erro que não estava previsto:**
```
Encontrei este erro ao integrar o código: [mensagem de erro]
Arquivo onde ocorre: [nome]
Linha aproximada: [número]
Me diga a causa e a correção mínima necessária, sem refatorar mais do que o necessário.
```

**Ordem de prioridade se precisar pausar:**
Se precisar pausar a refatoração no meio, os estados mais seguros para parar são:
- Após completar a Fase 1 (core.js está feito, tudo ainda funciona)
- Após completar a Fase 2 (serviço unificado, sistema funciona com wrapper)
- Não pause no meio da Fase 4 (hook + componente precisam ser trocados juntos)

---

*Gerado com base no diagnóstico técnico do sistema MODOQAP — abril 2026*
