# Foto e capa do perfil: diagnóstico de 03/09/2026

## Causa confirmada em produção

O serviço Cloud Run `uploadsecureimage`, em `us-central1`, está ativo, mas sua
política IAM retornou somente `etag`, sem bindings. A verificação IAM não está
desabilitada. O preflight OPTIONS do endpoint callable, com origem
`http://localhost:5173`, retornou HTTP 403. Os logs registraram repetidamente
`The request was not authenticated` mesmo após as publicações de hoje.

As requisições são bloqueadas antes de entrar no handler. O login Firebase não
substitui a autenticação IAM do Cloud Run. O callable precisa aceitar o transporte
público e validar `request.auth` no handler, como o código já faz.

Na versão instalada de `firebase-functions`, `onCall` emite `callableTrigger: {}`
sem exportar a opção `invoker`. Acrescentar `invoker: 'public'` às opções desse
handler não é prova de que a política IAM foi reparada. A política remota precisa
ser corrigida e verificada diretamente.

## Regressão adicional corrigida localmente

O commit `94f42d6` introduziu o upload seguro e os caminhos fixos `avatar` e
`covers/cover`. A tela apaga a capa anterior após salvar a nova. Como a URL mudava
apenas pelo token, a exclusão podia apagar o próprio objeto recém-gravado.

Agora foto/capa recebem caminhos únicos por upload. A tela usa o bucket da URL
retornada e só limpa a capa anterior se ela representar outro objeto. A validação
server-side continua exigindo JPEG/PNG/WebP, assinatura compatível e reencodificação.

## Etapa remota autorizada e publicada

1. Adicionar `allUsers` com `roles/run.invoker` somente ao serviço
   `uploadsecureimage`, preservando as demais entradas e o etag da política IAM.
2. Publicar somente `functions:uploadSecureImage` para enviar os caminhos únicos.
3. Confirmar preflight 204 para localhost e produção; chamada sem login deve
   continuar retornando `UNAUTHENTICATED` do callable.
4. Validar foto e capa autenticadas, substituição e recarregamento da página.

Após o usuário autorizar com "pode publicar", foi aplicado o binding
`roles/run.invoker` / `allUsers` somente em `uploadsecureimage`, preservando a
política existente, e executado `firebase deploy --only functions:uploadSecureImage
--project dashboard-pmba --non-interactive`. O CLI confirmou `Deploy complete!`.

A revisão `uploadsecureimage-00008-quj` recebe 100% do tráfego. Após o deploy,
OPTIONS retornou 204 com a origem correta para localhost:5173,
dashboard-pmba.web.app e dashboard-pmba.firebaseapp.com. POST sem autenticação
retornou 401 JSON com `UNAUTHENTICATED` e a mensagem de login obrigatório do handler.
A política IAM foi relida e o binding confirmado.

Não foram executados Hosting, commit ou push.
O frontend local inclui uma proteção adicional; sua publicação via Hosting não
faz parte do ajuste remoto proposto acima.

## Validação local

- Testes direcionados de segurança/upload: 6 passaram, incluindo sessão obrigatória,
  rejeição de tipo incompatível, reencodificação e isolamento entre versões.
- Suíte unitária completa: 357 passaram; 2 falharam no módulo Anki, na hierarquia
  de pastas (`tests/ankiPipeline.test.mjs:327` e `:348`), fora dos arquivos desta correção.
- Lint: zero erros, 314 avisos.
- Build Vite/PWA: concluído; aviso de tamanho de chunks.
- `git diff --check`: sem erros de whitespace.
- Upload autenticado e recarregamento do perfil ainda precisam de validação na
  sessão do usuário; nenhuma sessão autenticada estava disponível no navegador conectado.

Referências: https://firebase.google.com/docs/functions/callable-reference e
https://docs.cloud.google.com/run/docs/authenticating/public

## Correção complementar: mensagem falsa de erro e resposta imediata

Após a publicação da Function, o usuário confirmou a capa funcionando no localhost
e em produção. A foto atualizava no Auth, mas o Firestore retornava permissão negada.
A leitura das Rules publicadas confirmou `photoURL.matches('^https://')`: a expressão
não aceita uma URL completa. A validação foi corrigida para HTTPS com host e caminho,
mantendo tamanho máximo, isolamento entre usuários e proteção de campos administrativos.

O cliente agora confirma o Firestore antes de sincronizar a projeção do Auth em
segundo plano. O Dashboard mostra a imagem selecionada imediatamente, compartilha
o progresso entre telas, preserva a prévia contra snapshots antigos e desfaz a
mudança visual em caso de rejeição. URLs blob não são gravadas no perfil. A capa
não fica mais escurecida durante o envio; há um indicador discreto de progresso.
Foram removidos o refresh forçado do token da capa e o reload de Auth da foto.

Validação complementar: 373 testes unitários passaram, incluindo os testes de
resposta imediata, rollback e falha secundária no Auth; 4 testes no Firestore/Storage
Emulator passaram (perfil, capa, isolamento e campos protegidos); lint sem erros
(312 avisos); build Vite/PWA concluído. Não houve publicação nesta etapa.

A correção restrita das Rules está preparada em
`tmp/profile-proposed-production.rules`, com uma única linha modificada em relação
à versão publicada em `tmp/profile-current-production.rules`. Aplicar as Rules e
publicar o frontend depende de nova autorização: o escopo autorizado anteriormente
era somente IAM e `functions:uploadSecureImage`. O teste autenticado desta nova
versão no navegador permanece pendente.

### Publicação complementar autorizada

Após a autorização "pode sim", foram publicadas somente Firestore Rules e Hosting
usando a cópia congelada do build validado em `tmp/profile-release-20260903`.
O CLI confirmou `Deploy complete!`. Nenhuma Function, Storage Rule, índice,
commit ou push foi incluído nesta publicação complementar.

As Rules foram relidas antes da publicação para evitar sobrescrever uma alteração
remota concorrente. O ruleset ativo após a publicação é
`projects/dashboard-pmba/rulesets/7590c7a8-b77f-478b-a496-dd84bce84421` e corresponde
exatamente à correção preparada, com uma única linha alterada na versão anterior.

Verificação HTTP após publicação: index.html, sw.js, bundle principal, Dashboard
e ProfilePage retornaram 200 e SHA-256 idêntico ao build congelado. O serviço está
em https://dashboard-pmba.web.app. A verificação autenticada de salvar e recarregar
foto/capa nesta nova versão permanece a ser feita na sessão do usuário.
