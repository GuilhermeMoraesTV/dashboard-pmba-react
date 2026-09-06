# Diretrizes para Agentes de Desenvolvimento (AGENTS.md)

Este documento estabelece as regras obrigatórias, divisão de responsabilidades (ownership), contratos compartilhados e critérios de validação para todos os agentes de IA atuando no repositório `dashboard-pmba-react`.

---

## 1. Proteção de Publicação e da Branch Main (REGRA CRÍTICA)

* **Nunca execute publicação ou deploy do `dashboard-pmba`**, incluindo produção, canal privado ou canal de preview, sem que o usuário tenha solicitado essa ação diretamente na conversa atual.
* Se uma tarefa parecer exigir publicação ou deploy, mas o pedido não for explícito, pare antes dessa etapa, peça permissão ao usuário e aguarde a resposta.
* **Nunca crie commit enquanto a branch `main` estiver ativa, nem envie alterações para a branch `main`**, sem que o usuário tenha solicitado isso diretamente na conversa atual.
* Se uma tarefa parecer exigir commit ou envio para `main`, mas o pedido não for explícito, pare antes dessa etapa, peça permissão ao usuário e aguarde a resposta.
* Pedidos para corrigir, implementar, testar, finalizar ou entregar alterações não constituem, por si só, autorização para publicar, fazer deploy, criar commit em `main` ou enviar alterações para `main`.
* Uma autorização antiga, dada em outro chat ou para outra entrega, não vale para uma nova publicação, deploy, commit em `main` ou envio para `main`.
* Builds, testes e validações locais continuam permitidos, desde que não publiquem artefatos nem alterem ambientes remotos.

---

## 1.1 Arquitetura Zero-Cost e Eficiência Máxima no Firebase (REGRA CRÍTICA OBRIGATÓRIA)

Toda nova funcionalidade, alteração arquitetural, gatilho, listener, job agendado ou estrutura de persistência implementada neste projeto **DEVE obrigatoriamente ser projetada para manter o consumo do Firebase o mais próximo possível de custo zero**, operando confortavelmente dentro das franquias gratuitas do Firebase / Google Cloud Platform (GCP).

### Princípios Obrigatórios:

#### 1. Firestore
* **Sem scans históricos em caminhos comuns:** Nenhuma ação comum de usuário pode recalcular todo o histórico ou varrer coleções inteiras.
* **Escritas Estritamente Idempotentes:** Nunca execute `set`, `update` ou `add` sem alteração funcional real. Dados derivados e projeções devem sempre utilizar `payloadChanged` (ou comparação funcional equivalente) antes de qualquer escrita.
* **Sem escritas cosméticas:** Proibido disparar gravações apenas para atualizar timestamps cosméticos (ex.: `updatedAt`, `lastSeen`) se os dados funcionais permanecerem inalterados.
* **Proibição de $O(U^2)$ e $O(N)$ em cascata:** Proibido desenhar lógicas onde uma ação individual (ex.: estudar, pausar timer, entrar em grupo) dispare atualizações em todos os demais usuários ou rankings inteiros.
* **Agregados Incrementais:** Preferir sempre o cálculo de deltas pontuais (`daily_states`, `operations`) ao invés de reprocessar históricos completos.
* **Queries Eficientes:** Sempre aplicar limites (`limit()`), paginação e cursores em consultas do client e do backend.

#### 2. Cloud Functions & Triggers
* **Gatilhos de Alta Frequência:** Gatilhos acionados com frequência (como `active_timers`) devem ser $O(1)$, leves e nunca disparar cascatas de recálculo ou fan-out para outras coleções.
* **Sem Duplicação de Pipelines:** Triggers não devem refazer o trabalho que a chamada principal (callable ou client) já persistiu com consistência.
* **Idempotência em Retries:** Todos os gatilhos com retries ativados devem checar marcadores de conclusão antes de processar.

#### 3. Listeners em Tempo Real (Client)
* **Realtime com Propósito:** Utilizar `onSnapshot` exclusivamente onde a reatividade em tempo real agrega valor direto à experiência do usuário.
* **Ciclo de Vida Limpo:** Sempre registrar e invocar o `unsubscribe()` ao desmontar componentes ou trocar de rota/aba.
* **Limitação Rígida:** Utilizar `limit()` em queries ouvidas por snapshot para impedir consumo descontrolado à medida que as coleções crescem.

#### 4. Cloud Scheduler & Background Jobs
* **Sem Crons de Alta Frequência:** Proibido criar cron jobs com frequência de minutos (ex.: `every 1 minutes`) sem justificativa explícita e aprovação prévia.
* **Consolidação Diária:** Rotinas de manutenção diária devem ser consolidadas em um despachante único na madrugada (respeitando o limite gratuito de 3 Cloud Schedulers na GCP).
* **Isolamento de Falhas:** Cada etapa da rotina diária consolidada deve possuir tratamento independente de erro (`try/catch`), garantindo que a falha de uma etapa não interrompa as demais.

#### 5. Storage & Arquivos
* **Retenção e Limpeza:** Uploads temporários (como arquivos `.apkg` pós-importação ou mídias intermediárias) devem ser excluídos após o processamento ou ter políticas de ciclo de vida ativas.

### Checklist Obrigatório para Toda Nova Funcionalidade:
Antes de finalizar qualquer implementação, todo agente deve auditar e responder:
1. Quantos **reads** esta funcionalidade gera por ação comum?
2. Quantos **writes**?
3. Quantas **Functions** são invocadas?
4. O consumo cresce com o tamanho do histórico do usuário?
5. O consumo cresce com a quantidade total de usuários ($O(U)$ ou $O(U^2)$)?
6. Possui listeners em tempo real (`onSnapshot`)? Estão devidamente limitados e desinscritos?
7. Possui triggers de Firestore? O retry é idempotente?
8. Gera fan-out de escritas para outros documentos?
9. Pode um evento simples gerar dezenas ou centenas de operações em segundo plano?
10. Os dados temporários são devidamente limpos após o uso?

---

## 2. Arquitetura, Stack e Padrões do Projeto

* **Stack**: React 19, Vite 7, Tailwind CSS 3, Framer Motion, Firebase (Firestore, Storage, Functions v2, Auth).
* **Tipagem**: JavaScript modular com anotações JSDoc estritas (`@typedef`, `@param`, `@returns`). Não utilize TypeScript no código fonte.
* **Persistência do Usuário**: Todos os dados específicos de usuário devem ser armazenados sob subcoleções `users/{userId}/...` (`decks`, `cards`, `card_reviews`, `questions`, `question_attempts`, `error_book`, `documents`, `generated_items`).
* **Tratamento de Datas**:
  * No Firestore: utilize `Timestamp` / `serverTimestamp()`.
  * Na UI / API / Contratos de Transporte: converta para instâncias de `Date` ou strings ISO 8601 legíveis.
* **Configuração de Limites**: Não utilize números mágicos. Consulte sempre `src/config/productLimits.js` ou o documento remoto `system_config/product_limits`.

---

## 3. Divisão de Ownership entre Agentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                              OWNERSHIP                                 │
├──────────────┬─────────────────────────────────────────────────────────┤
│ Sonnet       │ Flashcards, Decks, Sessões de Estudo, SM-2 Scheduler    │
├──────────────┼─────────────────────────────────────────────────────────┤
│ Gemini       │ Banco de Questões (Global/Privado), Caderno de Erros,   │
│              │ Integração com Sistema de Revisões                      │
├──────────────┼─────────────────────────────────────────────────────────┤
│ Codex        │ Processamento de Documentos (PDF), IA Server-Side,      │
│              │ Importador de Pacotes Anki (.anki2, .anki21, .21b)      │
├──────────────┼─────────────────────────────────────────────────────────┤
│ Antigravity  │ Arquitetura, Fundação, Contratos Compartilhados,        │
│              │ Regras de Segurança e Documentação Mestre               │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### 3.1 Sonnet (Fase 1: Flashcards & Scheduler)
* Implementar a lógica concreta do algoritmo SM-2 na subclasse de `CardScheduler`.
* Desenvolver componentes de UI de Flashcards baseados nos 4 ratings: `'again'`, `'hard'`, `'good'`, `'easy'`.
* Implementar o serviço `src/services/flashcards/flashcardsService.js`.
* Preservar a assinatura congelada `reviewCard(userId, deckId, cardId, rating, options)`.
* Garantir gravação do histórico de revisões em `users/{userId}/card_reviews`.

### 3.2 Gemini (Fase 1: Questões & Caderno de Erros)
* Implementar interface de resolução de questões e listagem por matérias/bancas.
* Implementar `src/services/questions/questionsService.js` e `src/services/errorBook/errorBookService.js`.
* Garantir suporte tanto a questões globais (`questions/`) quanto privadas (`users/{uid}/questions/`).
* Garantir que respostas e gabarito sejam validados exclusivamente server-side via `submitQuestionAnswer`.
* Manter gabaritos exclusivamente em `questions/{questionId}/private/answerKey` ou `users/{uid}/questions/{questionId}/private/answerKey`.
* Integrar falhas em questões e flashcards ao Caderno de Erros polimórfico.

### 3.3 Codex (Fase 1: Documentos, IA Server-Side & Anki)
* Implementar upload direto de PDFs para Firebase Storage (`user_uploads/{userId}/documents/{docId}/...`).
* Implementar Cloud Functions para extração de texto de PDFs e invocação do Vertex AI com JSON Schema.
* Implementar importador de decks Anki (`collection.anki2`, `collection.anki21`, `collection.21b` com Zstd), respeitando a identidade `ankiNoteGuid + ankiCardOrd`.
* Garantir que questões geradas a partir de documentos privados sejam salvas exclusivamente no banco privado do usuário.

---

## 4. Contratos Compartilhados e Localização

Todos os contratos de dados e tipos compartilhados estão definidos e centralizados em `src/contracts/`:

* `src/contracts/flashcards.js`: Contratos de `Deck`, `Card`, `CardReview`, `QualityRating`, `OpaqueSchedulerState`.
* `src/contracts/questions.js`: Contratos de `Question`, `QuestionAnswerKeyEntity`, `QuestionAttempt`, `QuestionStatsEntity`, `SubmitQuestionAnswerRequest`, `SubmitQuestionAnswerResponse`.
* `src/contracts/errorBook.js`: Contratos de `ErrorBookEntry` e `ErrorBookPreview`.
* `src/contracts/documents.js`: Contratos de `UserDocument` e `GeneratedItem`.
* `src/contracts/ai.js`: Contratos de requisições de geração por IA orientadas a domínio.
* `src/contracts/index.js`: Ponto central de re-exportação.

---

## 5. Arquivos Críticos e Regras de Alteração

Antes de alterar qualquer um dos arquivos abaixo, analise o impacto transversal em outros módulos:

* `src/components/Dashboard.jsx`: Orquestrador principal da navegação e abas do aplicativo.
* `src/components/dashboard/NavSideBar.jsx`: Barra lateral de navegação.
* `firestore.rules`: Regras de segurança e autorização do banco Firestore.
* `storage.rules`: Regras de segurança de upload e leitura no Firebase Storage.
* `functions/index.js`: Ponto de entrada das Cloud Functions do backend.
* `src/config/featureFlags.js`: Chaveamento de recursos em desenvolvimento.

---

## 6. Comandos de Testes e Validação Obrigatória

Antes de considerar qualquer entrega ou fase concluída, execute obrigatoriamente a tríade de validação:

```bash
# 1. Executar testes unitários locais
npm run test:unit

# 2. Executar validação de linting (deve retornar 0 erros)
npm run lint

# 3. Executar compilação do Vite
npm run build
```

---

## 7. Como Propor Mudanças Arquiteturais

Se durante a implementação um agente encontrar uma incompatibilidade real ou necessidade de alteração estrutural:

1. **Não improvise silenciosamente.**
2. Documente a motivação técnica e a menor correção necessária.
3. Registre o novo ADR em `DECISIONS.md`.
4. Atualize os contratos correspondentes em `src/contracts/` e a documentação em `ARCHITECTURE.md`.
5. Garanta retrocompatibilidade ou plano coordenado de migração antes de prosseguir.
