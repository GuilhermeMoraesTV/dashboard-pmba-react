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
  6. O inventário conceitual cobre todos os chunks em janelas pequenas; a seleção ativa trabalha com poucos conceitos e cada geração pede no máximo dois cards. Em truncamento, o único retry reduz o escopo e preserva o mesmo teto de tokens.

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

---

### ADR-017: Chat Sequencial sem Fan-out de Escrita
* **Status**: Aprovada para o chat interno dos grupos.
* **Contexto**: Não lidos exatos, realtime e concorrência entre os participantes do grupo não podem produzir uma notificação ou um estado gravado por mensagem e por membro.
* **Decisão**:
  1. `study_groups/{groupId}/chat_meta/current` centraliza `lastSeq`, membros atuais e os campos mínimos de resumo; nunca armazena texto ou preview.
  2. Mensagem comum lê dois documentos e escreve mensagem, meta e state do remetente numa única transação. IDs são definidos antes da transação e reutilizados em retries.
  3. `lastMessageId` existe exclusivamente para as Rules provarem que a atualização atômica do meta referencia a mensagem criada no mesmo commit. `groupName` permite montar o resumo virtual sem ler um documento por grupo.
  4. Unread usa cursores e contadores pessoais O(1); nenhum documento é criado para cada destinatário.
  5. Somente menções criam outbox e acionam Function. `@Todos` reutiliza esse contrato ao persistir os UIDs reais dos demais membros, respeitando o limite atual do grupo. Notificações têm ID determinístico por grupo, mensagem e destinatário.
  6. O histórico expira por TTL em 90 dias. A reconciliação rara consulta a primeira sequência retida apenas quando o cursor ficou inativo além da janela de retenção.
  7. Listeners agregados são suspensos após 45 segundos em background; listeners da conversa são suspensos imediatamente.

---

### ADR-018: Identidade Estável e Manifesto Único do PWA
* **Status**: Aprovada.
* **Contexto**: Sem `id` explícito, o navegador usa `start_url` como identidade do PWA. A troca histórica de `/` para `/app/home`, combinada com dois manifestos declarados na mesma página, permitiu que Android/Chromium tratasse a versão atual como outro aplicativo e mantivesse a instalação antiga isolada.
* **Decisão**:
  1. `vite-plugin-pwa` é a única fonte do manifesto publicado; o link manual e o manifesto paralelo em `public/` deixam de existir.
  2. O manifesto declara `id: /app/home`, igual à identidade implícita da instalação atual, e mantém `scope: /`.
  3. O cliente solicita `registration.update()` ao iniciar, recuperar foco/visibilidade/conexão e em intervalo controlado enquanto a página estiver visível.
  4. O sistema não tenta remover instalações antigas: navegadores e sistemas operacionais não oferecem uma API web segura para desinstalar um PWA legado.

---

### ADR-019: Importação Anki Integral e Escritas Condicionais
* **Status**: Implementação local; publicação depende de autorização explícita.
* **Contexto**: A árvore exibe Pastas de Estudo, mas o importador só criava segmentos intermediários. Decks-folha sumiam da navegação, e cards próprios de decks-pais eram contados na pasta superior. Limites manuais também selecionavam só parte dos decks/cards.
* **Decisão**:
  1. Cada caminho Anki completo tem uma pasta real, incluindo decks vazios. A raiz compartilhada reutiliza o destino. Nomes iguais em níveis diferentes permanecem distintos. Esta é a menor mudança compatível com estudar/editar/excluir pastas; uma árvore virtual exigiria adaptar todas essas operações.
  2. Reimportação reutiliza IDs e pastas intermediárias existentes, corrigindo a atribuição antiga. Cards movidos para decks manuais são preservados; decks identificados como gerenciados pelo Anki são migrados para o deck e a folha canônicos, mesmo se a implementação anterior os deixou arquivados ou ligados a pasta obsoleta. Progresso e scheduler permanecem intactos.
  3. Limites próprios `anki.maxCardsPerDeck`, `maxDecksPerUser` e `maxFoldersPerUser` têm fallback 10.000, mantendo cotas de criação manual. Overrides remotos continuam soberanos. Cotas e conteúdo são validados antes de mídia/estrutura/cards; não se corta texto nem se seleciona um subconjunto silenciosamente.
  4. Cards existentes só recebem `update` quando conteúdo/atribuição muda. Progresso e scheduler são preservados. Índices estáveis só são escritos quando mudam. Objetos de mídia com hash por UID são reutilizados e novos uploads usam precondição de geração zero.
  5. Lotes agrupados por deck respeitam quantidade e orçamento de bytes. Card e avanço de contador/versão do deck são atômicos. Lotes confirmados e snapshots existentes provam persistência sem uma terceira leitura completa; falhas ambíguas exigem releitura e relatório incompleto.
  6. Lease técnico por usuário serializa imports concorrentes e expira após o timeout máximo da Function. É inacessível ao cliente. Não há atalho baseado apenas no hash do pacote: isso poderia esconder cards excluídos ou impedir correções de conteúdo. A identidade GUID+ordinal e o índice atual são mantidos para preservar compatibilidade.
  7. `cardsUnchanged`, `mediaUploaded`, `mediaReused` e `persistenceVerification` tornam a economia auditável. Nenhum descarte pode resultar em `isComplete=true`. Em falha, APKG permanece disponível e a reimportação retoma por identidade.
  8. Pastas importadas não consomem a cota manual de criação de raízes; arquivamento de árvores grandes usa lotes de até 400 operações. Paginação de estudo preserva segundos e nanossegundos do cursor Firestore, evitando repetir ou omitir cards entre páginas.
  9. O relatório detalhado por deck migra para JSON privado no Storage quando excede 256 KiB; o documento mantém totais e caminho, sem truncar os detalhes. Símbolos do SDK modular são injetados explicitamente na callable. A importação usa concorrência 1 por instância para evitar que vários APKGs grandes compartilhem o orçamento de memória.
* **Publicação futura**: requer `importAnkiPackage`, `createStudyFolder`, `createStudyFolderTree`, `deleteStudyFolder`, Rules do lease e frontend compatíveis. Nada é publicado automaticamente por esta implementação.

---

### ADR-020: Seletor local de ambiente Firebase com isolamento fail-closed
* **Status**: Implementação local; não requer nem autoriza publicação de Hosting.
* **Contexto**: O localhost podia usar o Firebase real e gerar custo ou alterar produção durante testes. A conexão do SDK é definida na inicialização, portanto uma troca segura exige persistir a escolha e recarregar a página.
* **Decisão**:
  1. O indicador de ambiente é um botão somente em `DEV` e loopback. A preferência `real|emulator` fica no `localStorage` e prevalece sobre o modo do Vite apenas no computador local.
  2. Ao escolher Emulator, um middleware exclusivo do Vite inicia a suíte por comando fixo, espera Auth, Firestore, Functions e Storage e só então grava a preferência e recarrega. Falhas mantêm o modo REAL visível; nunca simulam uma troca bem-sucedida.
  3. O Emulator inicializa o SDK com `demo-dashboard-pmba-local`, separando Auth/cache/dados e impedindo fallback acidental para recursos Firebase reais. O endpoint de controle aceita somente loopback e não recebe comandos ou caminhos do cliente.
  4. Voltar ao Firebase real exige confirmação explícita, pois pode gerar custos e alterar dados de produção. Os processos locais podem continuar ativos sem cobrança Firebase; outras abas podem estar usando-os.
  5. A automação cobre serviços Firebase. Integrações externas não emuladas continuam sujeitas aos contratos próprios e não são anunciadas como gratuitas.
  6. Ao alternar enquanto há usuário real autenticado, somente identidade pública e perfil de acesso já legível pelo próprio usuário são enviados ao middleware local. O Auth Emulator reutiliza a conta local de mesmo e-mail ou cria a identidade com o mesmo UID; uma senha aleatória exclusivamente local realiza o primeiro login e é descartada do `sessionStorage`. A senha real nunca é copiada.

---

### ADR-021: Sistema de Suporte Privado, Anexos Otimizados e Retenção de Imagens
* **Status**: Aprovada.
* **Contexto**: O suporte ao usuário requer envio de capturas de tela e imagens nos chamados e mensagens de resposta de usuários e administradores, com rigoroso isolamento de segurança, ausência de URLs públicas e minimização de custos com Firestore, Storage e Functions.
* **Decisão**:
  1. **Upload em 3 Etapas Idempotentes**: `reserve` (autenticado, aloca cota e ID determinístico) -> `upload` (validação de bytes, SHA-256 e conversão isolada para WebP) -> `finalize` (publicação atômica em transação Firestore).
  2. **Imagens Privadas e Otimizadas**: Apenas versões WebP necessárias são salvas no Storage (`image.webp` max 2560px Q80 e `thumbnail.webp` max 480px Q70); o arquivo original é sempre descartado. Acesso a bytes é 100% mediado por Cloud Function autenticada `readSupportAttachment` (`Cache-Control: private, no-store`).
  3. **Cotas e Proteção contra Abuso**: 30 imagens/dia para usuários normais, 200 imagens/dia para administradores, limite de 3 operações de upload/minuto por remetente.
  4. **Proteção de Chamados Resolvidos e Concorrência**: Transações no backend impedem respostas em chamados marcados como `resolvido`, bloqueando condições de corrida durante uploads concorrentes.
  5. **Política de Retenção de 15 Dias**: Chamados resolvidos expiram anexos após 15 dias; a rotina diária de manutenção física remove os arquivos WebP do Storage em lotes de 100 documentos, preservando integralmente o texto das mensagens.
  6. **Eficiência no Client**: Seleção de imagens sem chamadas de rede; miniaturas via lazy loading; cache efêmero em memória com `URL.revokeObjectURL` no fechamento da conversa; digitação em transições de estado assíncronas.
