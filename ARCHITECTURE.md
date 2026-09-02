# Arquitetura do Sistema — MODOQAP

Este documento consolida a arquitetura técnica, modelo de dados, contratos de domínio, diretrizes de segurança e padrões do ecossistema MODOQAP (dashboard-pmba-react).

---

## 1. Visão Geral e Pilha Tecnológica

* **Frontend**: React 19, Vite 7, Tailwind CSS 3, Framer Motion, Lucide Icons, Chart.js / Recharts.
* **Backend & Infraestrutura**: Firebase (Firestore, Storage, Authentication, Cloud Functions v2).
* **Tipagem e Documentação**: JavaScript modular com anotações JSDoc estritas (`@typedef`, `@param`, `@returns`).
* **Serviços de IA**: Google Vertex AI (Gemini 2.5 Flash / Pro) encapsulado server-side via Cloud Functions com validação de JSON Schema.

---

## 2. Domínios da Aplicação (Bounded Contexts)

```
                       ┌──────────────────────────────────────┐
                       │          MODOQAP Core App            │
                       └──────────────────┬───────────────────┘
                                          │
       ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
       │                  │                               │                  │
┌──────▼──────┐   ┌───────▼───────┐               ┌───────▼───────┐   ┌──────▼──────┐
│ Cronograma  │   │  Flashcards   │               │   Questões    │   │  Documentos │
│  & Ciclos   │   │  & Scheduler  │               │   & Erros     │   │    & IA     │
└─────────────┘   └───────────────┘               └───────────────┘   └─────────────┘
```

### 2.1 Cronograma & Ciclos de Estudo
* **Responsabilidade**: Planejamento semanal e por ciclo, cálculo determinístico de cotas e minutos (método Hamilton), distribuição de slots diários e agenda de revisões periódicas (24h, 7d, 15d, 30d).
* **Coexistência**: O sistema de cronograma existente e suas revisões coexistem com os flashcards sem interferência mútua.

### 2.2 Flashcards & Repetição Espaçada
* **Responsabilidade**: Gestão de pastas de estudo, baralhos privados, cartões de memorização e histórico completo de revisões.
* **Hierarquia de produto**: `StudyFolder -> Deck -> Card`. `StudyFolder` é a unidade principal da experiência; `Deck` permanece como entidade técnica do scheduler, Anki e compatibilidade histórica.
* **Conteúdo legado**: decks sem `folderId` são associados idempotentemente à pasta determinística `legacy_flashcards` sem recriar cards ou alterar IDs, revisões, scheduler ou metadados Anki.
* **Abstração do Scheduler**: O domínio de flashcards utiliza a abstração `CardScheduler` (`createInitialState`, `schedule`, `preview`, `isDue`).
* **Assinatura de revisão congelada**: `reviewCard(userId, deckId, cardId, rating, options)`, pois o card é endereçado dentro do deck.
* **Estado Opaco**: O estado matemático é versionado e opaco (`schedulerState: { algorithm, version, data }`), garantindo desacoplamento de algoritmos específicos.
* **Algoritmo Inicial**: SM-2 na Fase 1 (Sonnet), com arquitetura pronta para futura migração para FSRS.
* **Ratings Semânticos**: A UI expõe exclusivamente `'again' | 'hard' | 'good' | 'easy'`.
* **Persistência**:
  * Decks: `users/{userId}/decks/{deckId}`
  * Cards: `users/{userId}/decks/{deckId}/cards/{cardId}`
  * Histórico de Revisões: `users/{userId}/card_reviews/{reviewId}`

### 2.2.1 Adaptive Tutor de Flashcards
* **Fonte exclusiva**: toda geração acadêmica parte de uma `StudySource` pronta, pertencente ao usuário e na revisão atual. Conceitos, frente, verso e dificuldade cognitiva devem ser sustentados por `sourceRefs` rastreáveis.
* **Sessão autoritativa**: `users/{userId}/adaptive_study_sessions/{sessionId}` guarda estado, cotas, versão do algoritmo e métricas. O client não decide ownership, prioridade, materialização ou domínio.
* **Domínio por conceito**: `users/{userId}/concept_mastery/{masteryId}` mantém exposições, acertos, erros, sequências, estágio e `priorityBoost` por usuário, fonte e conceito.
* **Buffer pequeno**: `generated_items` é reutilizado como fila persistente (`generating -> ready -> served -> consumed`) com low-watermark, lease de refill, dedupe por fingerprint e cancelamento lógico.
* **Materialização**: um item pré-gerado só vira `Card` no primeiro rating. Uma transação determinística cria Card e CardReview, incrementa `Deck.cardCount` e atualiza ConceptMastery exatamente uma vez.
* **Dificuldades distintas**: `cognitiveDifficulty: easy | hard` descreve o conteúdo; `rating: again | hard | good | easy` continua pertencendo exclusivamente ao scheduler atual.

### 2.3 Banco de Questões (Global vs. Privado)
* **Banco Global (`questions/{questionId}`)**: Projeção client-safe oficial/administrada da plataforma. Leitura liberada para usuários autenticados; escrita restrita a administradores e backend.
* **Banco Privado (`users/{userId}/questions/{questionId}`)**: Projeção client-safe de questões criadas pelo usuário, geradas por IA a partir de PDFs ou importadas. Estritamente isolada por usuário.
* **Gabaritos protegidos**:
  * Global: `questions/{questionId}/private/answerKey`.
  * Privado: `users/{userId}/questions/{questionId}/private/answerKey`.
  * Nenhum SDK client, inclusive administrativo, possui leitura direta. O Admin SDK acessa os documentos no backend.
* **Segurança do Gabarito**: Documentos client-safe nunca contêm `correctOptionId`, `correctIndex`, resposta correta nem `explanation` reveladora.
* **Validação Server-Side**: O envio de respostas é intermediado pela Cloud Function `submitQuestionAnswer`, que valida o acerto e persiste a tentativa em `users/{userId}/question_attempts/{attemptId}`. A primeira resolução de cada questão também cria uma fonte acadêmica determinística em `users/{userId}/question_reward_sources/{sourceId}`, consumida pela gamificação oficial para aplicar blocos, limites diários, `xp_events`, `totalXP` e rankings sem recompensa duplicada.

### 2.4 Caderno de Erros (Polimórfico)
* **Responsabilidade**: Repositório centralizado de itens em que o estudante encontrou dificuldade para reestudo ativo.
* **Suporte Polimórfico**: Suporta erros originados tanto de Questões (`sourceType: 'question'`) quanto de Flashcards (`sourceType: 'flashcard'`).
* **Estrutura**: `users/{userId}/error_book/{entryId}`, contendo contadores de erros/acertos (`wrongCount`, `correctCount`), notas pessoais (`userNotes`), estado de domínio (`mastered`) e `preview` apropriado.
* **Identidade determinística**: `question:{questionScope}:{questionId}` para questões e `flashcard:{deckId}:{cardId}` para flashcards, gerada por helper compartilhado.

### 2.5 Documentos do Usuário & Processamento de IA
* **Upload Direto**: Arquivos enviados diretamente para o Firebase Storage em `user_uploads/{userId}/documents/{docId}/{name}` (sem uso de Base64 no Firestore).
* **Formatos da Versão 1**: Restrito estritamente a arquivos PDF (`maxPdfSizeBytes: 25MB`).
* **Pipeline de IA**:
  1. Upload do PDF no Storage.
  2. Registro do documento em `users/{userId}/documents/{docId}` (`status: 'pending'`).
  3. Cloud Function valida novamente MIME, tamanho, assinatura e ownership, extrai texto sem OCR, normaliza Unicode e persiste chunks privados rastreáveis por ordem e página.
  4. Após `status: 'processed'`, o client invoca função de domínio (`requestFlashcardGeneration`, `requestQuestionGeneration` ou `requestSummaryGeneration`).
  5. Backend monta prompts internos, valida schemas no provider abstrato de IA e persiste rascunhos em `users/{userId}/generated_items/{itemId}`.
  6. Questões de PDF são criadas somente em `users/{uid}/questions`, com gabarito separado em `private/answerKey`; nunca são promovidas automaticamente ao banco global.

---

## 3. Modelo de Persistência no Firestore

### 3.1 Padrão de Isolamento por Usuário (`users/{uid}/...`)
Exceto por coleções públicas/globais explicitamente administradas, todos os dados pertencentes ao usuário residem sob sua árvore de documentos:

```
users/{userId}/
  ├── study_folders/{folderId}
  ├── study_sources/{sourceId}/
  │     └── chunks/{chunkId}          (somente backend)
  ├── decks/{deckId}/
  │     └── cards/{cardId}
  ├── card_reviews/{reviewId}
  ├── adaptive_study_sessions/{sessionId}
  ├── concept_mastery/{masteryId}
  ├── questions/{questionId}          (projeção privada client-safe)
  │     └── private/answerKey          (somente backend)
  ├── question_attempts/{attemptId}   (tentativas validadas pelo backend)
  ├── question_reward_sources/{sourceId} (elegibilidade determinística de XP; somente backend)
  ├── question_stats/summary          (agregado derivado pelo backend)
  ├── error_book/{entryId}
  ├── documents/{docId}/
  │     └── chunks/{chunkId}          (somente backend)
  ├── generated_items/{itemId}
  ├── anki_imports/{importId}         (resultado client-readable)
  ├── anki_card_index/{identityId}    (somente backend)
  ├── ciclos/{cicloId}
  ├── cronogramas/{cronogramaId}
  └── registrosEstudo/{recordId}
```

### 3.2 Coleções Globais
* `questions/{questionId}`: Projeção client-safe do banco oficial.
* `questions/{questionId}/private/answerKey`: Gabarito global acessível somente pelo backend.
* `system_config/product_limits`: Configurações e limites dinâmicos do sistema.
* `system_broadcasts/{broadcastId}`: Comunicados gerais.
* `editais_templates/{templateId}`: Modelos de editais verticalizados.

---

## 4. Tipagem e Representação de Datas

Para evitar discrepâncias entre o banco de dados e a interface:

* **No Firestore (Persistência)**:
  * Campos de data/hora utilizam `Timestamp` ou `admin.firestore.FieldValue.serverTimestamp()`.
  * Campos padronizados: `dueAt`, `reviewedAt`, `attemptedAt`, `createdAt`, `updatedAt`.
* **No Client (UI / Transporte / Contratos)**:
  * Camada de serviço normaliza os `Timestamp` para instâncias de `Date` ou strings ISO 8601 legíveis.
  * O código nunca assume formato puro de string ao ler diretamente de `docSnap.data()`.

---

## 5. Modelo de Segurança

```
Client (React App)
   │
   ├─► Firebase Storage (Direct upload de PDF <= 25MB sob user_uploads/{uid}/...)
   ├─► Firestore (CRUD em users/{uid}/... com Firestore Rules)
   └─► Cloud Functions (Operações sensíveis: submitQuestionAnswer, IA, quotas)
```

1. **Firestore Rules**:
   * O usuário acessa diretamente apenas os próprios documentos privados e somente nas operações explicitamente permitidas por domínio; processamento, chunks e exclusão integral de PDF passam pelo backend.
   * As novas coleções possuem matchers explícitos; o fallback recursivo não concede acesso a elas.
   * `question_attempts` tem escrita bloqueada para o client, sendo gravada exclusivamente pela Cloud Function `submitQuestionAnswer`.
   * `questions/{id}` global permite leitura autenticada apenas da projeção client-safe; inclusive administradores comuns têm escrita pelo SDK client bloqueada.
   * Questões globais, answerKeys, tentativas, fontes de recompensa, estatísticas derivadas e criação de itens gerados são gravados exclusivamente pelo backend.
2. **Storage Rules**:
   * Caminho `user_uploads/{userId}/documents/{docId}/{allPaths=**}` valida `request.auth.uid == userId`, tipo `application/pdf` e tamanho `<= 25MB`; não existe exceção de leitura para admin client-side.
   * APKG só pode ser enviado pelo proprietário para `user_uploads/{uid}/anki_imports/{importId}`; mídias processadas são gravadas exclusivamente pelo Admin SDK.
3. **Secret Answer Isolation**:
   * O gabarito de questões nunca transita no payload de listagem ou detalhe de questões entregue ao frontend.

---

## 6. Pipeline de Importação Anki (Fase 1)

Para suportar importação sem perda de dados:
* Formatos suportados: `collection.anki2`, `collection.anki21` e o formato Zstd atual `collection.anki21b`; o alias histórico previsto `collection.21b` também é aceito.
* Chave de identidade lógica para reimportação idempotente: `ankiNoteGuid + ankiCardOrd`.
* Metadados preservados no card: `ankiNoteGuid`, `ankiNoteId`, `ankiCardOrd`.
* Templates são tratados como entrada não confiável: a importação renderiza apenas um subconjunto compatível, sanitiza HTML e nunca executa JavaScript ou add-ons.
* Mídias permitidas são validadas por nome, tamanho, assinatura e hash antes de serem armazenadas sob o UID do proprietário.
* Cards novos recebem apenas o estado inicial opaco do scheduler; cards existentes recebem atualização de conteúdo por merge, preservando `schedulerState`, `status`, `dueAt`, `lapses`, `reps` e `createdAt`.

---

## 7. Estratégia de Migração Futura: SM-2 para FSRS

* O estado é armazenado com versionamento de algoritmo: `{ algorithm: 'sm2', version: 1, data: { ... } }`.
* O histórico completo de revisões em `card_reviews` preserva `rating`, `elapsedTimeMs`, `reviewedAt`, `scheduledDays` e estados anteriores/posteriores.
* Com esse histórico preservado, um scheduler FSRS poderá ser treinado ou inicializado sem necessidade de conversões forçadas e imperfeitas de parâmetros SM-2.

---

## 8. Pipeline Incremental de Gamificação e Ranking

Alterações comuns em `registrosEstudo`, `simulados`, `question_reward_sources` e `metas` são processadas pelo dia acadêmico afetado. A pipeline consulta somente as fontes daquele dia, reaplica os limites diários e persiste o agregado em `users/{uid}/gamification/profile/daily_states/{dateKey}`.

O perfil mantém totais e métricas do período corrente. A diferença entre o agregado diário anterior e o novo atualiza XP, conquistas e rankings. `operations/{eventId_dateKey}` registra a conclusão idempotente e expira por TTL após 30 dias; uma tentativa repetida reconcilia projeções sem somar novamente.

Perfis que ainda não possuem o marco histórico de sequência fazem uma única recuperação compatível e persistem o marco. Depois disso, a atualização pública consulta somente o período posterior ao corte; perfis criados após o corte recebem marco zero sem varrer histórico inexistente.

As posições gerais e semanais de uma ação comum usam consultas agregadas `count()` para calcular somente a colocação do usuário alterado. A manutenção diária pode ordenar a coleção uma vez, mas grava exclusivamente posições funcionais diferentes. Rankings mensais dos grupos recebem a mesma projeção absoluta da pipeline principal, sem gatilhos acadêmicos paralelos.

O recálculo histórico integral permanece disponível apenas para migração, recuperação e transições raras de conclusão. Mesmo nesse caminho, eventos, conquistas, perfis e posições idênticos não recebem novos timestamps nem novas gravações.
