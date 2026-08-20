# Protecao de publicacao e da branch main

- Nunca execute publicacao ou deploy do `dashboard-pmba`, incluindo producao, canal privado ou canal de preview, sem que o usuario tenha solicitado essa acao diretamente na conversa atual.
- Se uma tarefa parecer exigir publicacao ou deploy, mas o pedido nao for explicito, pare antes dessa etapa, peca permissao ao usuario e aguarde a resposta.
- Nunca crie commit enquanto a branch `main` estiver ativa, nem envie alteracoes para a branch `main`, sem que o usuario tenha solicitado isso diretamente na conversa atual.
- Se uma tarefa parecer exigir commit ou envio para `main`, mas o pedido nao for explicito, pare antes dessa etapa, peca permissao ao usuario e aguarde a resposta.
- Pedidos para corrigir, implementar, testar, finalizar ou entregar alteracoes nao constituem, por si so, autorizacao para publicar, fazer deploy, criar commit em `main` ou enviar alteracoes para `main`.
- Uma autorizacao antiga, dada em outro chat ou para outra entrega, nao vale para uma nova publicacao, deploy, commit em `main` ou envio para `main`.
- Builds, testes e validacoes locais continuam permitidos, desde que nao publiquem artefatos nem alterem ambientes remotos.
