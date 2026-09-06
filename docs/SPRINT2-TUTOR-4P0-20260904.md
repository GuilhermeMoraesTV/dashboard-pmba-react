# Sprint 2 — quatro P0 do Tutor

Escopo: somente lifecycle, concorrência das respostas, entrega de ratings no encerramento e recuperação do lease do buffer. Nenhuma alteração desta tarefa em Anki, editor, Tree View, scheduler ou reinserção intradiária.

## Correções

1. `AdaptiveStudySession` assina um controlador local estável. Cleanup/StrictMode e remount não cancelam a sessão nem interrompem a fila. A outbox usa `sessionStorage`, isolado por projeto, usuário, pasta e fonte; preserva os mesmos IDs após reload e é removida depois do encerramento confirmado.
2. A lista local de itens respondidos filtra todas as respostas de start/rating/refill. Um callback antigo não avalia o próximo card: o ID esperado é conferido antes da aceitação. Cada item aceito mantém uma única operação lógica de review.
3. Encerrar congela novos ratings, aguarda start quando necessário, drena a fila e só depois cancela. Falhas ficam visíveis e preservam a outbox. A perda da confirmação de cancelamento mantém o estudo congelado até reconciliação, inclusive após reload.
4. O refill normal verifica a validade do lease, aposenta placeholders abandonados na transação existente e reserva o lote habitual. Uma geração antiga não apaga o lock sucessor, tanto no sucesso quanto no erro. Buffer vazio sem trabalho em andamento oferece ação de recuperação em vez de spinner indefinido.

## Validação reproduzível

Resultado final: **409 testes unitários aprovados; lint com 0 erros (319 avisos existentes); build aprovado; 7 testes de integração do Tutor aprovados no Emulator.**

```powershell
npm run test:unit
npm run lint
npm run build

# Testes direcionados do componente React real e do controlador:
node --test --test-isolation=none tests/adaptiveSessionController.test.mjs tests/adaptiveStudyLifecycle.test.mjs

# Firestore e Storage locais. NODE_TEST_CONTEXT ativa a configuração demo do cliente no runner Node.
$env:NODE_TEST_CONTEXT = 'child'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-22'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
firebase emulators:exec --config firebase.test.json --project dashboard-pmba --only firestore,storage "node --test --test-isolation=none --test-name-pattern=Adaptive tests/firestoreRules.test.mjs"
```

- 11 testes direcionados: StrictMode real, remount, respostas antigas de rating/refill, avaliações muito rápidas, avaliações lentas, falhas permanentes/transitórias, buffer vazio, encerramento pendente, confirmação de cancelamento perdida, reload/restart.
- 7 testes do Tutor no Emulator: idempotência/ownership/Rules, fonte e proveniência, anotação criada pelo serviço, PDF textual real processado no Storage Emulator, buffer zerado/refill, encerramento pendente, lease expirado e corrida com o lease sucessor. Provider de IA simulado; nenhuma chamada Vertex nesses testes.
- Conferência visual com componente real e API simulada: avanço imediato com rating de 3 segundos, buffer vazio acionável, exclusão de respondidos após reload, reinício e saída apenas após confirmação. Harness temporário em `tmp/tutor-p0-browser`.
- Logs locais: `tmp/tutor-p0-unit.log`, `tmp/tutor-p0-lint.log`, `tmp/tutor-p0-build.log`, `tmp/tutor-p0-emulator.log`.

Essas evidências deixam o fluxo pronto para teste manual. Não representam homologação autenticada do produto completo com Vertex real. Frontend/Hosting não foi publicado nesta tarefa.

## Custo incremental

| Situação | Leituras Firestore novas | Writes novos | Invocações / Vertex |
| --- | --- | --- | --- |
| Rating/sessão no fluxo normal | 0 | 0 | 0 adicionais |
| Lease expirado no refill normal | 0 | 1 por placeholder abandonado | Uma geração do lote normal; nenhum loop ou geração adicional dentro da chamada |
| Falha de geração | 1 leitura da sessão na transação de tratamento do erro, sujeita ao retry transacional existente | Sem aumento sobre o tratamento anterior; escrita da sessão somente se ainda possui o lease | 0 adicionais |
| Falha transitória / confirmação perdida | Leituras da operação idempotente repetida, apenas na exceção | Uma única review lógica, sem duplicar Card/CardReview/mastery | Até um retry automático por tentativa de sincronização; mesmo `reviewRequestId`; sem Vertex |
| Reload com outbox pendente | Reconciliação das operações pendentes existentes | Sem nova review lógica | Reenvio dos IDs pendentes; não cria outra sessão |

Sem polling, sem listener Firestore novo, sem listener por item, sem scheduler/triggers novos, sem fan-out, sem scans novos e sem aumento de `targetReady`, `refillSize` ou limites de geração. A fila é serial e o refill coalescido ocorre após confirmação dos ratings; saiu a chamada antecipada a cada clique. Outbox e exclusão de itens respondidos usam apenas armazenamento/memória local. O custo não cresce com o total de usuários; a recuperação usa os itens da sessão já consultados pelo backend.

## Publicação seletiva verificada

Pacote isolado em `tmp/tutor-p0-release-20260904`, derivado dos fontes remotos existentes. A única mudança de domínio publicada foi `adaptiveStudy/service.js`; o entrypoint do pacote expõe somente os dois endpoints abaixo.

- `startAdaptiveFlashcardSession`: `startadaptiveflashcardsession-00007-cil`, ACTIVE.
- `refillAdaptiveFlashcardSession`: `refilladaptiveflashcardsession-00010-tew`, ACTIVE.
- SHA-256 normalizado do serviço publicado em ambos: `2cf5f87835fa4ab52b7393d94b7028409505c3b49149b552049c6748ef97e435`.
- Inventário antes/depois: 75 / 75; somente esses dois endpoints mudaram, nenhum removido.
- Memória, timeout, CPU, concorrência e máximo de instâncias conferidos sem alteração.
- `rateAdaptiveFlashcard` e `endAdaptiveFlashcardSession`, Hosting, Rules, índices, Storage e demais Functions não foram publicados.
- Evidência: `tmp/tutor-p0-release-20260904/verification.json` e `deploy.log`.
