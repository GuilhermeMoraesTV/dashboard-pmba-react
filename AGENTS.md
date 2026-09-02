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
