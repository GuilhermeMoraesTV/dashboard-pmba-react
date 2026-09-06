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
* **Inventário completo, janela pequena**: todos os chunks da revisão da fonte participam da análise em janelas limitadas; apenas 8 conceitos por janela e 1–2 cards por geração entram no prompt ativo. `MAX_TOKENS` permite no máximo um retry com escopo menor, nunca com aumento automático do teto.
* **Telemetria server-side**: cada chamada registra tokens de entrada/saída, motivo/mensagem de término, quantidade pedida/retornada, duração, fonte e conceito; leitura de chunks, montagem do prompt e commit no Firestore têm tempos separados.
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
* `{{type:Field}}` é importado em modo compatível: a frente não revela o valor e o verso mostra a resposta; ocorrências são agregadas em um único aviso, sem simular o campo digitável completo do Anki.
* Mídias permitidas são validadas por nome, tamanho, assinatura e hash antes de serem armazenadas sob o UID do proprietário.
* O nome original do APKG fica apenas em metadados. O objeto temporário usa a chave ASCII estável `package.apkg`; imports antigos com divergência Unicode podem ser recuperados somente dentro do prefixo exclusivo do próprio `importId`.
* Cards novos recebem apenas o estado inicial opaco do scheduler; cards existentes recebem atualização de conteúdo por merge, preservando `schedulerState`, `status`, `dueAt`, `lapses`, `reps` e `createdAt`.
* O relatório só termina como completo quando `detectados = novos + atualizados + ignorados`, todos os lotes concluem, a reconciliação não falha e a contagem persistida corresponde aos cards válidos do parser.

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

---

## 9. Chat Interno dos Grupos de Estudo

O chat usa uma sequência monotônica por grupo e não cria fan-out de escrita para mensagens comuns. O envio normal é uma única transação client-side que lê `chat_meta/current` e o estado do remetente, grava a mensagem, avança o meta e atualiza `lastSendAt`/`sentCountTotal`. Em contenção, o mesmo ID é preservado nos retries; o fluxo comum permanece em aproximadamente 2 reads e 3 writes.

```
study_groups/{groupId}/
  ├── chat_meta/current               (sem texto ou preview)
  ├── messages/{messageId}            (seq autoritativa; TTL de 90 dias)
  └── typing/{uid}                    (presença efêmera)

users/{uid}/
  ├── group_chat_states/{groupId}     (cursor e contadores do próprio usuário)
  └── group_chat_mention_outbox/{id}  (somente quando há menção; TTL de 14 dias)
```

* **Ordem**: `chat_meta.lastSeq` é incrementado em exatamente uma unidade; horário de dispositivo nunca ordena mensagens.
* **Unread O(1)**: `(lastSeq - lastReadSeq) - (sentCountTotal - sentCountAtRead)`, com piso zero, exclui mensagens próprias sem documentos por destinatário.
* **Resumo global**: um listener `collectionGroup('chat_meta')` filtrado por `memberIds array-contains uid` e um listener da coleção pessoal de states são combinados em memória. Não há listener por card de grupo.
* **Conversa aberta**: primeira página de 30 mensagens por cursor; depois, listener apenas para `seq > highestSeq`. Ao voltar do background, o catch-up ocorre em lotes de 100.
* **Menções**: apenas mensagens com menção criam outbox. `@Todos` é expandido para os UIDs reais dos demais membros, respeitando o limite atual do grupo; a Function valida mensagem e membership e usa IDs determinísticos para notificar somente esses UIDs.
* **Segurança**: chat de grupo público continua privado aos membros. Rules impedem spoof de autor/seq, updates separados do meta/state, cursor regressivo, edição após 15 minutos e moderação sem permissão.

---

## 10. Identidade e Atualização do PWA

O PWA possui uma única fonte de manifesto, gerada por `vite-plugin-pwa`, e identidade explícita estável em `id: /app/home`. O `start_url` pode evoluir sem criar uma segunda identidade de aplicativo. O cliente verifica atualizações no carregamento, ao voltar ao primeiro plano, ao recuperar a conexão e periodicamente enquanto estiver visível; a ativação continua dependente da confirmação do usuário.

## 11. Importação Anki integral (ADR-019)

`APKG → validação SQLite/conteúdo/cotas → árvore completa → mídia por hash → lotes atômicos → relatório`.
Cada deck Anki, inclusive folha ou vazio, recebe uma Pasta de Estudo própria. Cards diretos de um deck-pai pertencem à mesma pasta que contém os subdecks; os totais visuais somam os diretos e os descendentes uma única vez. A reimportação repara a estrutura anterior e preserva identidade, histórico e movimentos para decks manuais. Associações antigas ainda gerenciadas pelo Anki são movidas para o deck/folha canônicos, com decremento e incremento atômicos dos contadores. A árvore reutiliza o `deck.cardCount` reconciliado pelo backend para o total e não executa outra agregação total por deck.

O backend mantém cards em `users/{uid}/decks/{deckId}/cards/{identity}` e o índice existente em `anki_card_index`. Um lease privado em `anki_import_locks/active` serializa importações do mesmo usuário. Não há migração destrutiva para coleção nova. A leitura inicial do índice é em grupos de IDs existentes; decks novos dispensam leitura de cards inexistentes. Escritas sem mudanças são eliminadas. Falhas de lote são explícitas e mantêm o APKG para recuperação.

Limites APKG independentes permitem 10.000 cards por pacote/deck e até 10.000 decks/pastas por usuário por padrão, sujeitos a overrides remotos e limites de arquivo/descompressão. O sistema rejeita excesso antes de gravar a estrutura em vez de importar uma fração. Testes: `tests/ankiImportScale.test.mjs`; prova com persistência real local: `scripts/verify-anki-emulator.mjs` exige ambos os hosts de Emulator em localhost e usa apenas projeto `demo-anki-local`.

---

## 12. Alternância local entre Firebase real e Emulator (ADR-020)

Em `localhost`, `EnvironmentBadge` permite alternar o ambiente. A ida para Emulator chama apenas o middleware local `POST /__modoqap/firebase-emulators/start`; o Vite executa o script fixo de inicialização e responde quando Auth `9099`, Firestore `8085`, Functions `5001` e Storage `9199` estão prontos. A aplicação persiste a escolha e recarrega porque clientes Firebase já inicializados não são religados em runtime.

O modo Emulator usa o projeto isolado `demo-dashboard-pmba-local`, não as credenciais/configuração de `dashboard-pmba`. O controle de processos rejeita clientes que não sejam loopback. Em Hosting/preview, o seletor não é renderizado e nenhuma preferência local pode ativar emuladores. Voltar ao ambiente real pede confirmação explícita.

Quando a troca parte de uma sessão real autenticada, o middleware local espelha no Auth/Firestore Emulator o UID, e-mail, nome, foto e perfil de acesso já disponíveis ao usuário. Uma credencial aleatória local é usada uma vez para autenticar após o reload e então removida da sessão; nenhuma senha do Firebase real é lida ou armazenada. Se já existir uma conta local com o mesmo e-mail, ela é promovida ao perfil espelhado para preservar seus dados de teste.

---

## 13. Sistema de Suporte Privado e Anexos Otimizados (ADR-021)

O sistema de suporte atende abertura de chamados e respostas de usuários e administradores com suporte a imagens privadas (até 3 por mensagem, até 5 MB por imagem, nos formatos JPEG, PNG e WebP estático).

```
system_feedback/{ticketId}/
  ├── (documento do ticket com status, lastUpdate, unreadUser/Admin, attachmentsExpireAt)
  └── messages/{messageId} (texto, remetente, timestamp, attachments: [...])

support_operations/{key} (reserva autenticada, fingerprint, lease, TTL 24h)
support_quotas/{uid}     (cotas diárias e rate limit por minuto, TTL 48h)
support_cleanup/{docId}  (fila de exclusão e expiração de anexos)

Storage:
support_attachments/{ticketId}/{messageId}/{attachmentId}/
  ├── image.webp     (lado máx 2560px, Q80)
  └── thumbnail.webp (lado máx 480px, Q70)
```

* **Segurança e Regras**: Storage é blindado contra leitura e escrita direta de clientes (`allow read, write: if false;`). Firestore nega escrita direta em `system_feedback` e `messages`. Acesso a imagens é mediado exclusivamente pelo endpoint HTTP autenticado `readSupportAttachment` com validação transacional de autorização.
* **Ciclo de Vida em 3 Etapas**: Reserva autenticada (`reserveSupportMessage`) -> Upload e processamento sequencial Sharp (`uploadSupportAttachment`) -> Publicação atômica em transação (`finalizeSupportMessage`).
* **Retenção e Expiração**: Chamados resolvidos agendam expiração dos anexos para 15 dias (`attachmentsExpireAt = now + 15d`). A rotina diária existente (`executarRotinaDiariaManutencao`) executa a remoção física dos arquivos em lotes indexados limitados (`maintenanceBatch: 100`), mantendo os textos históricos íntegros.
* **Eficiência e Escala**: Escopo de envio estritamente $O(1)$. Zero operações Firebase na seleção de arquivos. Miniaturas em lazy loading e cache de Blobs em memória descartado ao fechar a conversa.
