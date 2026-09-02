# Registro de Decisões Arquiteturais (ADRs)

Este documento registra formalmente as decisões arquiteturais aprovadas para o projeto MODOQAP.

---

### ADR-001: Manutenção da Stack React 19 + Firebase com JSDoc
* **Status**: Aprovada.
* **Contexto**: A aplicação utiliza React 19, Vite, Tailwind CSS e Firebase Firestore / Cloud Functions v2, com JavaScript anotado em JSDoc.
* **Decisão**: Preservar a stack existente sem introduzir TypeScript ou reescrever camadas maduras. Toda tipagem de novos domínios é expressa através de contratos JSDoc formais em `src/contracts/`.

---

### ADR-002: Abstração do CardScheduler com Estado Opaco e Ratings Semânticos
* **Status**: Aprovada.
* **Contexto**: O agendamento de flashcards necessita de algoritmo inicial (SM-2), mas deve permitir migração futura para FSRS sem quebrar dados existentes.
* **Decisão**:
  1. A interface pública expõe ratings semânticos: `'again' | 'hard' | 'good' | 'easy'`.
  2. O estado matemático é mantido opaco e versionado (`schedulerState: { algorithm, version, data }`).
  3. No nível de domínio, apenas `dueAt`, `status`, `lapses` e `reps` ficam no documento raiz do card.
  4. A implementação concreta do SM-2 é delegada ao Sonnet na Fase 1.
  5. O histórico completo de revisões é preservado em `card_reviews`.

---

### ADR-003: Validação de Gabarito de Questões Exclusivamente Server-Side
* **Status**: Aprovada.
* **Contexto**: Expor o gabarito no payload da questão antes da resposta permite inspeção no navegador e fraude em métricas e gamificação.
* **Decisão**:
  1. `Question` entregue ao client não possui `correctOptionId` nem `explanation` reveladora.
  2. O gabarito global reside em `questions/{questionId}/private/answerKey`; o privado, em `users/{uid}/questions/{questionId}/private/answerKey`.
  3. Nenhum SDK client possui leitura direta do answerKey, inclusive contas administrativas.
  4. A submissão ocorre via Cloud Function `submitQuestionAnswer`, que valida o gabarito, calcula XP e persiste a tentativa em `users/{uid}/question_attempts`.
  5. O client tem permissão de escrita bloqueada em `question_attempts`.

---

### ADR-004: Segregação entre Banco Global e Banco Privado de Questões
* **Status**: Aprovada.
* **Contexto**: O sistema precisa suportar questões oficiais da plataforma e questões privadas do aluno (criadas manualmente ou geradas por IA a partir de PDFs).
* **Decisão**:
  1. Banco Global: `questions/{questionId}` (leitura para autenticados, escrita admin).
  2. Banco Privado: `users/{userId}/questions/{questionId}` (isolado no UID do aluno).
  3. Questões geradas por IA a partir de PDFs privados nunca são publicadas automaticamente no banco global.
  4. `QuestionAttempt` identifica o escopo através de `questionScope: 'global' | 'private'`.

---

### ADR-005: Caderno de Erros Agnóstico e Polimórfico
* **Status**: Aprovada.
* **Contexto**: O estudante comete erros em questões e em flashcards; o caderno de erros deve unificar esses itens para revisão focada.
* **Decisão**: `ErrorBookEntry` é polimórfico, suportando `sourceType: 'question' | 'flashcard'`, `sourceId`, contadores (`wrongCount`, `correctCount`), `userNotes`, `mastered` e objeto de `preview` adaptável. A identidade determinística é `question:{questionScope}:{questionId}` ou `flashcard:{deckId}:{cardId}`, sempre gerada pelo helper compartilhado.

---

### ADR-006: Upload Direto para Firebase Storage e Restrição a PDF na v1
* **Status**: Aprovada.
* **Contexto**: Enviar arquivos grandes via Base64 para Firestore ou Cloud Functions consome memória e estoura limites de documento (1MB).
* **Decisão**:
  1. O upload é realizado diretamente pelo client para o Firebase Storage em `user_uploads/{userId}/documents/{docId}/{filename}`.
  2. Na primeira versão, apenas arquivos PDF são suportados (`maxPdfSizeBytes: 25MB`).
  3. Arquivos `.apkg` pertencem ao domínio específico de importação do Anki.
  4. PDFs privados são acessíveis no client somente pelo proprietário; operações privilegiadas usam Admin SDK.

---

### ADR-007: Isolamento de Serviços de IA Server-Side
* **Status**: Aprovada.
* **Contexto**: Chamadas diretas a APIs de IA a partir do frontend expõem tokens, aumentam risco de custos descontrolados e dificultam validação de schemas.
* **Decisão**:
  1. O frontend invoca métodos de domínio (`requestFlashcardGeneration`, `requestQuestionGeneration`).
  2. A Cloud Function no backend monta prompts, aplica schemas de resposta, controla quotas e chama a API do Vertex AI.

---

### ADR-008: Configuração Dinâmica de Limites de Produto
* **Status**: Aprovada.
* **Contexto**: Limites de negócio (tamanho de arquivos, quantidade de cards por lote, cotas diárias) mudam com a evolução do produto e não devem exigir novo deploy.
* **Decisão**: A fonte de verdade é o documento `system_config/product_limits` no Firestore. O arquivo `src/config/productLimits.js` provê defaults de fallback e função de resolução segura.

---

### ADR-009: Identidade de Reimportação Anki
* **Status**: Aprovada.
* **Contexto**: Usuários que reimportam pacotes Anki atualizados não devem ter seus cartões duplicados.
* **Decisão**: A identidade lógica para reimportação idempotente prioriza a tupla `ankiNoteGuid + ankiCardOrd`.

---

### ADR-010: Representação de Datas Persistidas com Timestamp
* **Status**: Aprovada.
* **Contexto**: Firestore armazena datas de forma otimizada para queries com `Timestamp`.
* **Decisão**: Documentos persistidos no Firestore utilizam `Timestamp` / `serverTimestamp()`. A conversão para `Date` ou strings ISO 8601 é realizada na camada de serviços e transporte do client.

---

### ADR-011: Rules Explícitas para os Novos Domínios Privados
* **Status**: Aprovada.
* **Contexto**: Matchers recursivos sobrepostos podem anular restrições específicas e conceder acesso client-side excessivo.
* **Decisão**: Decks, cards, reviews, questões privadas, answerKeys, tentativas, estatísticas, caderno de erros, documentos e itens gerados possuem regras explícitas. Esses domínios são excluídos do fallback recursivo. Admin SDK realiza operações privilegiadas; contas admin no client não recebem acesso privado automático.

---

### ADR-012: Assinatura de Revisão de Flashcard
* **Status**: Aprovada.
* **Decisão**: A assinatura pública congelada é `reviewCard(userId, deckId, cardId, rating, options)`, alinhada ao path físico `users/{uid}/decks/{deckId}/cards/{cardId}`.

---

### ADR-013: Edição Privada Preserva Gabarito e Recompensa de Questão é Determinística
* **Status**: Aprovada para correção de integridade da Fase 1.
* **Contexto**: O client não pode ler o gabarito protegido. Exigir que toda edição o reenvie fazia alterações de conteúdo sobrescreverem a resposta correta com valores artificiais. Submissões sem identidade pública também permitiam repetição de tentativas e XP.
* **Decisão**:
  1. Em criação privada, `answerKey` continua obrigatório. Em edição, sua ausência significa preservar o documento protegido existente; se as novas alternativas não contiverem a resposta preservada, o backend exige um novo gabarito explícito.
  2. A assinatura pública congelada de `submitQuestionAnswer` não muda. O backend deriva IDs determinísticos por usuário, escopo, questão e alternativa para deduplicar a tentativa, e por usuário, escopo e questão para conceder elegibilidade de recompensa apenas uma vez.
  3. A recompensa é uma fonte acadêmica server-side consumida pela gamificação oficial; blocos, limites diários, `xp_events`, `totalXP` e rankings permanecem sob a mesma fonte de verdade.
  4. A identidade textual congelada do Caderno de Erros é preservada. IDs de flashcard contendo o delimitador `:` são rejeitados pelo helper para impedir ambiguidades.

---

### ADR-014: StudyFolder como Raiz da Experiência de Flashcards
* **Status**: Aprovada para a Sprint 2.
* **Contexto**: A exposição simultânea de pastas, decks e cards globais fragmentava a navegação e permitia conteúdo sem unidade de organização visível.
* **Decisão**:
  1. A hierarquia de produto é `StudyFolder -> Deck -> Card`; Deck não é removido e permanece técnico para scheduler, Anki e histórico.
  2. Novos cards, decks, fontes e imports Anki exigem destino `folderId` pertencente ao usuário.
  3. Conteúdo legado é associado idempotentemente à pasta determinística `legacy_flashcards`, atualizando somente decks sem pasta.
  4. A raiz de Flashcards lista apenas StudyFolders e ações principais; fontes e detalhes técnicos ficam no interior da pasta.

---

### ADR-015: Adaptive Tutor Server-Side, Source-Only e Materialização no Primeiro Rating
* **Status**: Aprovada para a Sprint 2.
* **Contexto**: O estudo contínuo exige adaptação após cada resposta, mas não pode expor decisões de domínio, gerar conhecimento externo à fonte ou duplicar efeitos em retries concorrentes.
* **Decisão**:
  1. Toda sessão exige StudyFolder e StudySource prontas, pertencentes ao usuário e na revisão atual; a análise de conceitos fica versionada na própria fonte.
  2. `generated_items` é o único buffer persistente, com tamanho interno pequeno, fingerprint, variantes, provenance e estados de fila.
  3. `cognitiveDifficulty` (`easy | hard`) é independente do rating do scheduler (`again | hard | good | easy`).
  4. Card, CardReview, cardCount e ConceptMastery nascem/avançam em uma única transação determinística no primeiro rating; repetir a request retorna o mesmo resultado.
  5. Encerrar a sessão desativa refill. Resultados tardios podem concluir tecnicamente, mas são descartados se a sessão não estiver ativa.

---

### ADR-016: Gamificação Incremental, Projeções Idempotentes e Ranking por Agregação
* **Status**: Aprovada para correção da regressão de custo de 23/08/2026.
* **Contexto**: Uma alteração acadêmica relia o histórico completo, regravava eventos e 47 conquistas, recalculava coleções inteiras de ranking e ainda disparava uma segunda pipeline mensal. Retries repetiam as mesmas cobranças.
* **Decisão**:
  1. Fontes acadêmicas comuns recalculam apenas o dia afetado e aplicam ao perfil a diferença do agregado diário persistido.
  2. Escritas derivadas comparam somente campos funcionais; `updatedAt` nunca é motivo isolado para gravar.
  3. A posição de uma ação comum é calculada com `count()` e atualizada apenas para o usuário afetado. A manutenção global é O(U), nunca O(U²), e grava somente posições alteradas.
  4. O ranking mensal de grupos é projetado pela pipeline acadêmica principal; os gatilhos mensais duplicados deixam de existir.
  5. Marcadores determinísticos de operação tornam retry seguro e recebem TTL de 30 dias.
  6. Heartbeats usam lease local entre abas, dois envios máximos na partida e projeção de presença limitada a uma atualização por minuto quando o estado não muda.
