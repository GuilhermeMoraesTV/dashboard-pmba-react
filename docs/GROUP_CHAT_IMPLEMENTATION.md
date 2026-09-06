# Chat interno para grupos de estudo — relatório local

## Scroll e abertura por não lidas em 04/09/2026

* Abertura usa o estado `group_chat_states` antes de posicionar a lista: final sem novas mensagens; primeira recebida após `lastReadSeq` com separador estável quando há não lidas. `initialTopMostItemIndex` substitui o scroll imperativo disparado antes da montagem.
* Histórico virtualizado usa chave pelo ID da mensagem, cabeçalho de identidade e altura estáveis e acompanhamento instantâneo somente de mensagens novas quando o usuário está no final. A paginação preserva a âncora e conta apenas IDs efetivamente inseridos. Locks síncronos impedem consultas concorrentes; callbacks de grupos desmontados são descartados.
* Muitas não lidas são abertas por cursor em páginas de 30, com paginação também para frente. Mensagens recebidas durante a leitura de uma janela antiga não criam lacunas na lista. O botão de novas mensagens pode buscar diretamente a página mais recente.
* Abrir não marca tudo como lido. Leitura só é agendada no final completo, com a página visível e online; sair do final ou ocultar a página cancela a espera. A transação não avança além da sequência observada. Alterar o callback do componente pai ou recuperar a conexão não reinicia a janela.
* Custo: abertura acrescenta uma leitura do estado do usuário às até 30 mensagens da página recente. Quando a primeira não lida ficou fora dela, lê mais uma página de até 30; não percorre o intervalo inteiro. Cada página anterior/seguinte ou salto explícito ao final lê até 30 mensagens. Marcação mantém duas leituras transacionais e até uma escrita idempotente. Nenhuma Function nova, listener por card, trigger, fan-out, índice ou estrutura persistente nova.
* Validação visual com o componente real e dados simulados locais: última mensagem 120 sem não lidas; primeira 111 com dez não lidas; primeira 41 com oitenta não lidas; posição preservada ao receber a 121 durante a leitura da 111; paginação para frente preservando a leitura; indicador de digitação sem deslocamento no final. Essa prova visual não usa conta autenticada nem escreve mensagens reais.
* Paginação anterior com alturas variáveis: mensagem 41 permaneceu a 60 px do topo do viewport antes e depois da inserção. A âncora pelo ID e offset corrige a estimativa do virtualizador após a medição; paginação aguarda o fim do movimento e exige nova interação para outra página. Salto explícito ao final confirmado com diferença inferior a 1 px para o fim do scroll.
* Validação final: 426/426 testes unitários aprovados, lint sem erros (317 avisos na execução final) e build aprovado. Nenhuma publicação foi executada para esta correção.
* Referências: [posicionamento inicial](https://virtuoso.dev/react-virtuoso/virtuoso/initial-index/) e [componentes estáveis no Virtuoso](https://virtuoso.dev/react-virtuoso/troubleshooting/).

## Correção de carregamento em 04/09/2026

* Reproduzido HTTP 504 em `react-virtuoso.js?v=eb9f06de`: versão otimizada antiga, rejeitada pelo Vite. A configuração agora limita a descoberta ao `index.html` e inclui `react-virtuoso` na otimização inicial.
* O botão do `TabErrorBoundary` recarrega o documento em falhas de importação, pois `React.lazy` mantém a rejeição em cache. Erros comuns de renderização continuam com recuperação local.
* `useGroupChatSummaries` preserva a mensagem de diagnóstico do Firestore. A consulta `collectionGroup('chat_meta')` com `memberIds array-contains uid` exige índice de campo com escopo `COLLECTION_GROUP`.
* Consulta remota via `firebase firestore:indexes --project dashboard-pmba --json` confirmou a ausência desse índice. Após autorização explícita nesta conversa, publicado somente `chat_meta.memberIds` com escopo `COLLECTION_GROUP` e modo `CONTAINS`; estado remoto confirmado como `READY`. Os três índices de coleção existentes foram preservados. A operação registrou somente um delta `ADD`, por PATCH do campo com `updateMask=indexConfig`. Não houve publicação de Hosting, Functions, Rules ou dos demais índices locais.
* Validação desta correção: 411/411 testes unitários; lint sem erros (320 avisos); build aprovado. Importação real de `GroupChatPanel` e suas dependências aprovada no navegador e HTTP 200 para o painel e `react-virtuoso`. O navegador disponível estava sem autenticação; não houve validação de conversa autenticada nesta rodada.
* Impacto Firebase: nenhum novo read ou write de documento pela aplicação, chamada de Function, listener, scan histórico no fluxo do usuário, trigger, fan-out ou dado temporário. Mantidos os listeners e seu ciclo de vida. O novo índice adiciona armazenamento de entradas e foi construído pelo Firestore sobre os dados existentes; não modifica mensagens ou participantes.

Referências: [otimização de dependências do Vite](https://vite.dev/config/dep-optimization-options) e [escopo de índices Firestore](https://firebase.google.com/docs/firestore/query-data/index-overview).

## Escopo entregue

* Conversa responsiva dentro de Grupos, com texto, respostas, edição por 15 minutos, soft delete, moderação, menções, typing, estado otimista, retry visível e bloqueio de envio offline.
* Histórico paginado em 30 itens, cursor sem offset, lista virtualizada e catch-up em lotes de 100.
* Resumo virtual na Central de Notificações, com badge `99+`, acesso direto ao grupo e apenas dois listeners globais de chat.
* Membership sincronizado por backend, estado de novo membro iniciado em `lastSeq` e remoção do state ao sair do grupo.
* TTL de 90 dias para mensagens e 14 dias para outbox; campos de conteúdo sem índices desnecessários.
* Firestore Rules específicas e testes de membro, estranho, ex-membro, grupo público, spoof, atomicidade, rate limit, cursor, edição, moderação, typing, menções e collection group.

## Custo operacional esperado

| Fluxo | Reads da aplicação | Writes | Observação |
|---|---:|---:|---|
| Abrir conversa | até 30 | 0 | primeira página |
| Mensagem comum | 2 | 3 | O(1), sem Function e sem fan-out de writes |
| Mensagem com menção | 2 | 4 + notificações | outbox e somente destinatários mencionados |
| Receber mensagem com chat aberto | 1 | 0 | por cliente realmente conectado |
| Marcar como lido | 2 | até 1 | write omitido quando já está no final |
| Typing por 20 s | 0 | até 5 | throttle de 4 s, não por tecla |
| Página antiga | até 30 | 0 | cursor |

Para 1.000 mensagens comuns, a instrumentação projeta 2.000 reads transacionais e 3.000 writes, mais entregas realtime somente aos clientes conectados. O crescimento é linear e não depende da quantidade total de membros para writes.

## Benchmark concorrente no Emulator

Comando reproduzível: `npm run benchmark:group-chat`. Foram executadas cinco rodadas em cada nível; todas terminaram com sequência contínua, IDs únicos, meta consistente e zero falhas permanentes.

| Envios simultâneos | Retries | Falhas | Média tentativas | Máx. tentativas | p95 tentativas | p95 latência | Latência máxima |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 128 | 0 | 3,56 | 8 | 7 | 2.945 ms | 3.534 ms |
| 25 | 599 | 0 | 5,79 | 10 | 9 | 3.164 ms | 3.464 ms |
| 50 | 1.874 | 0 | 8,50 | 15 | 13 | 5.659 ms | 6.571 ms |

O teste inicial mostrou que o Emulator pode devolver contenção validada por Rules como `permission-denied`, sem retry interno do Web SDK. O serviço trata somente esse caso depois que a transação chegou à fase de escrita, verifica o ID idempotente e aplica backoff com jitter. Uma negação antes das leituras/escritas não é reclassificada como contenção.

## Evidências locais

* `npm run test:unit`: 346/346 testes aprovados; suíte completa com Firestore/Storage Emulators: 405/405.
* Rules no Emulator: 4/4 cenários focados de Chat aprovados; consulta agregada de timers ativos também aprovada.
* `npm run benchmark:group-chat`: 15/15 rodadas aprovadas, sem perda, duplicidade ou lacuna de sequência.
* Build de produção: aprovado; o painel de chat é carregado em chunk lazy próprio.
* ESLint dos arquivos alterados: zero erros; os avisos restantes já existiam nos componentes legados tocados.
* Navegador autenticado contra Emulators: abertura da conversa, badge não lido, envio, edição, resposta, autocomplete e entrega de menção, paginação até a mensagem 1 e layout móvel em 390 × 844 confirmados. A Function de menções processou o outbox local sem duplicar a mensagem.

## Estado de publicação

Implementação e validações são estritamente locais. Nenhum commit, push, deploy de Functions, Rules, índices ou Hosting foi executado.
