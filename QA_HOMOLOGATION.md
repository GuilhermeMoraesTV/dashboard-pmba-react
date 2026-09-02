# Checklist de Homologação Manual do Sistema — ModoQAP

Este documento serve como guia mestre de homologação funcional, segurança, usabilidade e isolamento para validação manual pré e pós-deploy do sistema ModoQAP (`dashboard-pmba-react`).

> **Nota de QA Paralelo**: Os itens marcados com `[AGUARDANDO SONNET]` ou `[AGUARDANDO CODEX]` devem ser executados após a conclusão das respectivas frentes de desenvolvimento.

---

## 1. Ambiente

- [ ] **Ação**: Verificar variáveis de ambiente de frontend e emuladores locais (`VITE_FIREBASE_*`).
  - [ ] **Resultado esperado**: Aplicação inicializa sem warnings de configuração faltando e conecta corretamente aos serviços Firebase.
- [ ] **Ação**: Executar build de produção (`npm run build`) e linting (`npm run lint`).
  - [ ] **Resultado esperado**: Build gerado sem erros e 0 erros no linter.
- [ ] **Ação**: Verificar service worker PWA e cache de assets.
  - [ ] **Resultado esperado**: Service worker registrado com sucesso e app utilizável offline em recursos em cache.

---

## 2. Login / Permissões

- [ ] **Ação**: Fazer login com Usuário Aluno Comum (Usuário A).
  - [ ] **Resultado esperado**: Acesso concedido à dashboard do aluno, sem acesso a rotas `/admin` nem visualização de dados de outros alunos.
- [ ] **Ação**: Tentar acessar diretamente URL de documento/item de outro aluno (Usuário B).
  - [ ] **Resultado esperado**: Acesso negado com mensagem amigável ou redirecionamento de segurança; erro de permissão bloqueado pelas Firestore Rules.
- [ ] **Ação**: Fazer login com Usuário Administrador.
  - [ ] **Resultado esperado**: Painel admin liberado, sem permissão de bypass client-side em gabaritos privados ou PDFs protegidos.

---

## 3. Questões

- [ ] **Ação**: Acessar listagem de Questões Globais (com feature flag de questões ativa).
  - [ ] **Resultado esperado**: Lista de questões renderizada com enunciado, alternativas e metadados (banca, disciplina, ano), sem nenhum indício do gabarito correto no HTML/DOM ou payload de rede.
- [ ] **Ação**: Filtrar questões por disciplina, assunto e banca.
  - [ ] **Resultado esperado**: Listagem atualiza exibindo apenas as questões correspondentes aos critérios selecionados.
- [ ] **Ação**: Selecionar alternativa e clicar em "Responder Questão".
  - [ ] **Resultado esperado**: Chamada para `submitQuestionAnswer` é disparada; spinner de carregamento exibido; retorno seguro exibe se a resposta foi correta ou incorreta, a alternativa correta oficial e a explicação comentada.
- [ ] **Ação**: Criar uma Questão Privada (com enunciado, 4 alternativas e gabarito).
  - [ ] **Resultado esperado**: Criação ocorre via backend seguro (`upsertPrivateQuestion`); gabarito é salvo isolado em `users/{uid}/questions/{id}/private/answerKey`; questão aparece na aba de questões privadas do usuário.
- [ ] **Ação**: Editar o enunciado de uma Questão Privada sem reenviar o gabarito.
  - [ ] **Resultado esperado**: Gabarito anterior é preservado com integridade caso as alternativas continuem válidas.
- [ ] **Ação**: Excluir uma Questão Privada criada pelo usuário.
  - [ ] **Resultado esperado**: Questão e seu answerKey são removidos com sucesso; lista é atualizada sem resíduos visuais.

---

## 4. Caderno de Erros

- [ ] **Ação**: Errar intencionalmente uma questão (global ou privada).
  - [ ] **Resultado esperado**: Item é automaticamente inserido no Caderno de Erros (`users/{uid}/error_book/question:{scope}:{id}`) com `wrongCount = 1`, `correctCount = 0`, `mastered = false`.
- [ ] **Ação**: Acessar a página do Caderno de Erros.
  - [ ] **Resultado esperado**: Questão errada aparece listada com preview do enunciado, alternativa assinalada e status de pendente.
- [ ] **Ação**: Adicionar anotações pessoais do estudante (`userNotes`) a uma entrada do caderno de erros e salvar.
  - [ ] **Resultado esperado**: Nota é persistida com sucesso e reexibida ao reabrir o item.
- [ ] **Ação**: Re-resolver a questão através do Caderno de Erros e acertar.
  - [ ] **Resultado esperado**: `correctCount` é incrementado para 1, mantendo o histórico de tentativas.
- [ ] **Ação**: Marcar o erro como "Dominado" / "Superado".
  - [ ] **Resultado esperado**: `mastered` torna-se `true`, `masteredAt` é registrado e os contadores de progresso de domínio são atualizados.
- [ ] **Ação**: Filtrar Caderno de Erros por "Apenas Pendentes", "Apenas Dominados" e por disciplina.
  - [ ] **Resultado esperado**: Filtros funcionam de forma responsiva e instantânea.

---

## 5. Gamificação

- [ ] **Ação**: Responder corretamente a uma questão pela primeira vez.
  - [ ] **Resultado esperado**: XP acadêmico é concedido e refletido no perfil e ranking semanal.
- [ ] **Ação**: Responder novamente à mesma questão correta em outro momento (retry).
  - [ ] **Resultado esperado**: Resposta é registrada sem duplicar recompensa de XP (idempotência via `question_reward_sources`).
- [ ] **Ação**: Submeter requisições de resposta em alta concorrência (duplo clique rápido).
  - [ ] **Resultado esperado**: Apenas uma tentativa é processada com recompensa de XP; transação impede duplicação ou farming de XP.

---

## 6. Documentos

- [ ] **Ação**: Enviar um PDF válido `<= 25MB` via arrastar e soltar (drag-and-drop).
  - [ ] **Resultado esperado**: Upload direto com barra de progresso no Storage; registro do documento criado com `status: 'pending'` e posterior transição para `'processing'` / `'processed'`.
- [ ] **Ação**: Tentar enviar arquivo não-PDF (ex: `.txt`, `.docx`, `.exe`).
  - [ ] **Resultado esperado**: Upload é bloqueado no client e nas regras de Storage com mensagem explicativa.
- [ ] **Ação**: Tentar enviar PDF com tamanho `> 25MB`.
  - [ ] **Resultado esperado**: Validação de limites bloqueia o envio antes de consumir banda desnecessária.
- [ ] **Ação**: Tentar enviar arquivo PDF vazio (0 bytes) ou corrompido sem cabeçalho `%PDF-`.
  - [ ] **Resultado esperado**: Rejeição imediata na validação de assinatura de arquivo.
- [ ] **Ação**: Excluir um documento PDF processado.
  - [ ] **Resultado esperado**: Documento e arquivo no Storage são excluídos de forma coordenada e atômica.

---

## 7. IA (Inteligência Artificial Server-Side)

- [ ] **Ação [AGUARDANDO CODEX]**: Solicitar geração de questões a partir de um PDF processado.
  - [ ] **Resultado esperado**: Job assíncrono é disparado; Cloud Function processa chunks com Vertex AI; rascunhos de questões estruturadas são gravados em `users/{uid}/generated_items/`.
- [ ] **Ação [AGUARDANDO CODEX]**: Solicitar geração de flashcards a partir de documento.
  - [ ] **Resultado esperado**: Rascunhos de flashcards são gerados em `generated_items` com frente, verso e tags sugeridas.
- [ ] **Ação [AGUARDANDO CODEX]**: Aprovar um item gerado (questão ou flashcard).
  - [ ] **Resultado esperado**: Item tem `status` atualizado para `approved` e é promovido para a coleção de destino privada correspondente.
- [ ] **Ação [AGUARDANDO CODEX]**: Rejeitar um item gerado de baixa qualidade.
  - [ ] **Resultado esperado**: Item tem `status` atualizado para `rejected` e não é inserido no banco de estudos.

---

## 8. Anki (.apkg)

- [ ] **Ação [AGUARDANDO CODEX]**: Enviar pacote `.apkg` padrão (`collection.anki2` ou `collection.anki21`).
  - [ ] **Resultado esperado**: Upload direto para `user_uploads/{uid}/anki_imports/`; Cloud Function descompacta, extrai baralhos, notas e cards sanitizados, mapeando para Decks e Cards privados do usuário.
- [ ] **Ação [AGUARDANDO CODEX]**: Enviar pacote `.apkg` moderno com compressão Zstandard (`collection.anki21b` / `collection.21b`).
  - [ ] **Resultado esperado**: Descompressão Zstd bem-sucedida e importação completa de todos os cards.
- [ ] **Ação [AGUARDANDO CODEX]**: Reimportar o mesmo pacote `.apkg` atualizado após o usuário já ter estudado alguns cards.
  - [ ] **Resultado esperado**: Cards existentes são atualizados por chave lógica `ankiNoteGuid + ankiCardOrd`, mantendo intactos `schedulerState`, `status`, `dueAt`, `lapses` e `reps`.
- [ ] **Ação [AGUARDANDO CODEX]**: Tentar enviar `.apkg` malformado, ZIP bomb ou com path traversal (`../`).
  - [ ] **Resultado esperado**: Rejeição segura pelo parser server-side sem comprometer o sistema.

---

## 9. Flashcards [EXECUTAR APÓS SONNET]

- [ ] **Ação [AGUARDANDO SONNET]**: Criar um novo Baralho (Deck) com nome, descrição e tags.
  - [ ] **Resultado esperado**: Deck é criado em `users/{uid}/decks/{deckId}` com `cardCount: 0`.
- [ ] **Ação [AGUARDANDO SONNET]**: Criar Flashcards manuais dentro do Deck (frente, verso e tags).
  - [ ] **Resultado esperado**: Cards criados em `users/{uid}/decks/{deckId}/cards/{cardId}` com `status: 'new'`, `lapses: 0`, `reps: 0` e `schedulerState` inicial.
- [ ] **Ação [AGUARDANDO SONNET]**: Iniciar sessão de estudos de Flashcards estilo Anki.
  - [ ] **Resultado esperado**: Interface exibe a frente do primeiro card devido (`due`); botão "Mostrar Resposta" revela o verso e os 4 botões de avaliação: `'Again'`, `'Hard'`, `'Good'`, `'Easy'` com seus respectivos intervalos de tempo previstos.
- [ ] **Ação [AGUARDANDO SONNET]**: Classificar card como `'Again'`.
  - [ ] **Resultado esperado**: Card transita para `relearning`, `lapses` é incrementado em 1, revisão é gravada em `users/{uid}/card_reviews/` e card entra no Caderno de Erros (`sourceType: 'flashcard'`).
- [ ] **Ação [AGUARDANDO SONNET]**: Classificar card como `'Good'` ou `'Easy'`.
  - [ ] **Resultado esperado**: Card recebe novo `dueAt` futuro calculado pelo SM-2, `reps` é incrementado e log de revisão é persistido.
- [ ] **Ação [AGUARDANDO SONNET]**: Concluir todos os cards devidos da sessão.
  - [ ] **Resultado esperado**: Tela de parabéns / sessão concluída é exibida, com estatísticas do estudo.

---

## 10. Scheduler SM-2 [EXECUTAR APÓS SONNET]

- [ ] **Ação [AGUARDANDO SONNET]**: Revisar card repetidamente nos intervalos programados com classificação `'Good'`.
  - [ ] **Resultado esperado**: Intervalos crescem progressivamente de acordo com o algoritmo SM-2 (1 dia -> 6 dias -> fator de facilidade).
- [ ] **Ação [AGUARDANDO SONNET]**: Revisar card com classificação `'Hard'`.
  - [ ] **Resultado esperado**: Fator de facilidade (Ease Factor) é ajustado para baixo e intervalo cresce a uma taxa menor.

---

## 11. Central de Revisões

- [ ] **Ação**: Acessar a Central de Revisões existente.
  - [ ] **Resultado esperado**: Revisões periódicas do cronograma/ciclo tradicional (24h, 7d, 15d, 30d) operam normalmente e sem interferência mútua com os flashcards.
- [ ] **Ação**: Verificar filtros por matéria, status de atraso e conclusão de revisões.
  - [ ] **Resultado esperado**: Comportamento estável e consistente com dados históricos do aluno.

---

## 12. Feature Flags

- [ ] **Ação**: Com flags desligadas (`questions: false`, `errorBook: false`, `flashcards: false`), navegar pelo sistema.
  - [ ] **Resultado esperado**: Itens não aparecem na barra de navegação lateral (`NavSideBar`) nem no Dashboard.
- [ ] **Ação**: Com flags desligadas, tentar forçar navegação direta por URL (`/questoes`, `/caderno-erros`, `/flashcards`).
  - [ ] **Resultado esperado**: `resolveFeatureTab` redireciona o usuário de volta para a aba `'home'` de forma segura.
- [ ] **Ação**: Com flags habilitadas, validar que todos os novos módulos surgem na barra lateral e são acessíveis.
  - [ ] **Resultado esperado**: Telas abrem fluidamente e sem travamentos.

---

## 13. Mobile (Responsividade)

- [ ] **Ação**: Acessar o sistema em viewport mobile (375px - 430px).
  - [ ] **Resultado esperado**: Menu lateral recolhido em gaveta (drawer); cards de estudo e botões de resposta têm toque acessível (mínimo 44x44px); sem overflow horizontal indesejado.
- [ ] **Ação**: Responder questão e virar flashcard no smartphone via toque.
  - [ ] **Resultado esperado**: Animações suaves de transição (Framer Motion) e botões confortáveis para o polegar.

---

## 14. Desktop

- [ ] **Ação**: Acessar o sistema em tela ampla (1920x1080).
  - [ ] **Resultado esperado**: Layout estruturado em grade multi-colunas, aproveitamento de espaço adequado e atalhos de teclado (ex: 1=Again, 2=Hard, 3=Good, 4=Easy, Espaço=Virar).

---

## 15. Estados de Erro

- [ ] **Ação**: Desconectar a internet e tentar responder uma questão ou submeter revisão.
  - [ ] **Resultado esperado**: Toast/alerta informa falha de conectividade sem crash na UI e permite tentar novamente.
- [ ] **Ação**: Tentar submeter formulário com campos obrigatórios vazios.
  - [ ] **Resultado esperado**: Validação inline destaca campos em vermelho com mensagem clara.

---

## 16. Segurança

- [ ] **Ação**: Inspecionar requisições de rede no DevTools ao abrir tela de questões.
  - [ ] **Resultado esperado**: Nenhuma informação de `correctOptionId`, resposta correta ou explicação preliminar está presente nos dados retornados do Firestore.
- [ ] **Ação**: Tentar gravar diretamente no Firestore em `users/{uid}/question_attempts/` através do console do navegador.
  - [ ] **Resultado esperado**: Operação rejeitada pelas regras de segurança com `permission-denied`.
- [ ] **Ação**: Tentar ler `questions/{id}/private/answerKey` ou `users/{uid}/questions/{id}/private/answerKey` no console.
  - [ ] **Resultado esperado**: Operação rejeitada com `permission-denied`.
- [ ] **Ação**: Tentar baixar PDF de outro usuário via Firebase Storage URL forjada.
  - [ ] **Resultado esperado**: Operação rejeitada pelas Storage Rules com `permission-denied`.
