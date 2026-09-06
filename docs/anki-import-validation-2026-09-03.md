# Importação Anki: validação local — 03/09/2026

## Escopo e publicação

Correção da árvore completa, cards, paginação e reimportação econômica. Sem deploy, commit, push ou alteração de dados de produção. Checkout compartilhado contém mudanças de outros trabalhos.

## Evidências

- `tests/ankiPipeline.test.mjs` + `tests/ankiImportScale.test.mjs`: 30/30 testes passaram, incluindo SDK modular, restauração de cards excluídos, retomada após falha, preservação de revisões, concorrência, cotas e relatório grande.
- `npm run test:unit`: 376/376 passaram na execução final.
- `npm run build`: passou; avisos de tamanho de chunks.
- `npm run lint`: passou, 0 erros e 312 avisos existentes no checkout durante a execução.
- `scripts/verify-anki-emulator.mjs`: persistência real em Firestore e Storage locais, projeto `demo-anki-local`, sem conexão com produção. PORTUGUÊS: 2.045 cards, 22 pastas, 19 decks com cards, 61 mídias; PMBA: 4.160 cards, 127 pastas, 108 decks com cards, 1.147 mídias. Reimportações conservaram todos os cards e reutilizaram todas as mídias.
- Fixture de escala no Emulator: 5.200 cards, 6.763 pastas incluindo raiz, 520 decks; reimportação completa sem cards alterados.
- Testes novos de Rules passaram na execução completa: lease privado, árvore acima de 500 pastas, paginação de 225 cards com timestamps contendo nanossegundos. A suíte completa teve uma falha de Adaptive Tutor fora deste escopo (62/63 passaram nessa execução).

## Custo medido no teste instrumentado

Fixture de 5.200 cards e 6.762 novas subpastas: primeira importação com 18.207 escritas (incluindo cards, índices, pastas, decks, contadores e controle). Reimportação idêntica: 5 escritas de controle, 0 escritas de cards, 0 de índices; 18.206 leituras estimadas pelo test double. Estes números não são fatura Firebase nem incluem listeners, rede, CPU ou Storage. A leitura de verificação é mantida para detectar conteúdo alterado, cards excluídos e contadores legados.

## Gate ainda pendente: navegador integrado

O teste autenticado pelo navegador encontrou ausência de `FieldValue` no namespace do SDK usado pela callable. Corrigido pela injeção explícita de `FieldValue`, `FieldPath` e `Timestamp`, com regressão unitária aprovada.

A repetição do fluxo foi bloqueada por alterações concorrentes em `functions/gamification/service.js`: erros de sintaxe em linhas móveis (2445–2497) impediram o carregamento de todas as Functions. A execução focal de Rules posterior também foi bloqueada pelo mesmo arquivo. Não foi alterado esse trabalho paralelo. Portanto, não se considera homologado o fluxo final navegador → callable → estudo/reload, embora o serviço Anki tenha prova de persistência no Emulator.

Após estabilizar a gamificação, repetir importação via interface, conferir subtotais 156/70 e folhas 39/31/16/1.381, estudar/recarregar e reimportar. Publicação depende de autorização e dos recursos listados na ADR-019. Dados antigos devem ser reparados por reimportação na mesma pasta, preservando histórico.

## Publicação autorizada nesta conversa

O usuário autorizou publicar os recursos necessários para testar no localhost. Preparado pacote isolado em `tmp/anki-release-20260903`, sem modificar ou carregar a gamificação. O entrypoint contém apenas as quatro callables selecionadas, extraídas do código principal, com dependências travadas. Importador com concorrência 1 por instância; demais limites de execução preservados.

As Rules foram obtidas da versão realmente ativa em produção, e não do checkout compartilhado. A diferença publicada limita-se a negar acesso a `anki_import_locks` e excluir essa coleção do wildcard legado; as demais regras de produção foram preservadas. Versão anterior: `7590c7a8-b77f-478b-a496-dd84bce84421`.

`scripts/verify-anki-release.mjs` passou contra emuladores: quatro handlers reais do pacote; rejeição de chamadas sem autenticação; 5.200 cards persistidos; reimportação integral inalterada; preservação de revisão; criação de raiz/árvore apesar de mais de 500 pastas Anki; arquivamento em lotes; paginação de 225 cards com nanossegundos nas duas modalidades. Rules propostas negaram leitura/escrita/exclusão do lease e preservaram o acesso legado permitido. Regressão Anki: 30/30. ESLint dos arquivos desta entrega: sem erros/avisos.

O navegador de teste não concluiu a navegação por timeout de comunicação local; não é evidência de homologação visual. Testes isolados concluíram após liberar os processos de teste. O localhost `http://localhost:5173` foi conferido por HTTP e está em modo development, conectado ao projeto real `dashboard-pmba`, sem emuladores. Não houve Hosting, indexes, Storage Rules, commit, push ou reimportação em dados de usuário de produção nesta publicação.

Aviso do provedor: runtime Node.js 20 deverá ser atualizado antes da desativação em 30/10/2026. Não foi promovida uma atualização de runtime/dependências nesta entrega.

## Seletor local de ambiente

O badge foi convertido em botão de alternância local. O teste real no navegador começou com `Firebase REAL`, iniciou automaticamente Auth/Firestore/Functions/Storage, persistiu `modoqap_firebase_mode=emulator`, recarregou como `Firebase EMULATOR` e criou uma conta descartável no Auth Emulator. A suíte reportou todos os serviços prontos usando `demo-dashboard-pmba-local`; não houve erro de console. Evidências visuais: `output/firebase-real-toggle.png` e `output/firebase-emulator-toggle.png`.

### Resultado da implantação

- Firestore Rules: publicação concluída. Ruleset resultante observado: `6db26ad7-f3b1-4e1a-9602-2fc7d054985d`.
- A primeira implantação das quatro Functions em paralelo foi recusada por cota regional de CPU no healthcheck. A estratégia de retry foi uma Function por vez, sem aumentar cotas ou alterar outros serviços.
- `importAnkiPackage`: retry isolado concluído com `Successful update operation` e `Deploy complete!`. O teto foi reduzido de 10 para 2 instâncias, concorrência 1 por instância, suficiente para dois usuários simultâneos e compatível com o lease individual.
- `createStudyFolder`, `createStudyFolderTree` e `deleteStudyFolder`: publicadas após o importador liberar cota, com CPU `gcf_gen1`, concorrência 1 e `Successful update operation` para as três.
- Smoke remoto: as quatro URLs responderam HTTP 401/`UNAUTHENTICATED` a chamadas sem credencial, confirmando revisão saudável e proteção de autenticação.
- Consultas adicionais de cota e de revisões Cloud Run foram recusadas pelo usuário na aprovação de comandos; não foram repetidas por outro meio. O estado `ACTIVE` isolado retornado anteriormente pela API de Functions não foi tratado como prova de tráfego saudável após o healthcheck falhar.
