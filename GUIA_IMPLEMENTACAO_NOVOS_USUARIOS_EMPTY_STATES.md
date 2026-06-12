# Guia de Implementacao: Novos Usuarios e Estados Vazios

## Resumo
Este guia organiza a implementacao para melhorar a primeira experiencia de usuarios sem dados, padronizar estados vazios, corrigir notificacoes, remover a pagina Metas, ajustar calendario/sequencia e melhorar o carregamento da pagina Noticias.

## Prompts de Implementacao

### 1. Componente global de estado vazio
Criar `src/components/shared/EmptyStateCard.jsx` com props `icon`, `title`, `description`, `actionLabel`, `onAction`, `variant`, `className` e `compact`. Usar visual vermelho/zinc, borda suave, icone arredondado, CTA opcional e compatibilidade dark mode.

### 2. Guia de estudo na Home para usuario novo
Em `src/pages/HomePage/HojeCard.jsx`, quando nao houver ciclo nem cronograma, renderizar `EmptyStateCard` com CTA para Planejamento em vez de retornar `null`.

### 3. Cards vazios da Home
Padronizar os estados vazios em `HomeSessao2.jsx`, `HomeInsightsCards.jsx`, `HomeSessao1.jsx` e `HomePage.jsx`, usando `EmptyStateCard` para Estudo de Hoje, Ranking, Evolucao, Estudo Semanal e Historico.

### 4. Notificacoes apos cadastro
Em `src/hooks/useNotifications.js` e `src/components/shared/BroadcastReceiver.jsx`, filtrar broadcasts para usuarios comuns por `timestamp >= user.metadata.creationTime`, preservando previews/testes para admin.

### 5. Excluir notificacao
Em `src/components/shared/NotificationPanel.jsx`, garantir que a lixeira remova broadcasts ativos e tambem itens da aba antigas, persistindo no localStorage por usuario.

### 6. Planejamento de novo usuario sem voltar
Em `Dashboard.jsx`, calcular novo usuario sem depender de metas. Em `PlanejamentoPage.jsx` e `PlanejamentoNovoPage.jsx`, ocultar o botao Voltar quando o seletor for aberto diretamente para usuario sem planejamento.

### 7. Remover pagina Metas
Remover `GoalsTab` do lazy import, remover o case `goals` do renderizador e remover o item Metas da sidebar. Manter leitura de `metas` se ainda alimentar historico ou estatisticas.

### 8. Calendario e sequencia neutros
Em `studyDayStatus.js`, retornar `no-data` para dias sem plano e sem registro. `goal-not-met` deve ocorrer apenas quando havia estudo planejado.

### 9. Loading de Noticias
Em `NoticiasPage.jsx`, substituir skeletons simples por um loading informativo com `EmptyStateCard` em modo loading e grid com shimmer.

### 10. Padronizacao global
Aplicar `EmptyStateCard` nas principais superficies vazias: Desempenho, Simulados, Cronogramas, Ciclos, Revisao, Noticias e Edital, sem mexer em mensagens pequenas de tabela/modal.

## Checklist de Aceite
- Home de usuario novo mostra o guia de estudo com CTA para Planejamento.
- Planejamento abre direto na escolha Ciclo/Cronograma e sem botao Voltar para novo usuario.
- Broadcast antigo anterior ao cadastro nao aparece para usuario comum.
- Lixeira remove notificacoes ativas e historico antigo.
- Metas nao aparece no menu nem renderiza como tab.
- Calendario e sequencia ficam neutros para usuario sem planejamento.
- Noticias exibe carregamento bonito.
- `cmd /c npm run build` executa sem erro.
