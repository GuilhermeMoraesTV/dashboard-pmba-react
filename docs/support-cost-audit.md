# Auditoria de Custos e Análise Operacional — Sistema de Suporte e Anexos

Este documento detalha o custo operacional real, medições instrumentadas, volumetria de dados, consumo de recursos (Firestore, Storage, Cloud Functions) e garantias de escalabilidade do sistema de suporte privado e anexos de imagem do MODOQAP.

---

## 1. Princípios de Otimização e Minimização de Custos

1. **Zero Operações Firebase na Seleção/Cancelamento de Imagens**: A seleção de arquivos no cliente realiza validações estritamente locais (formato, tamanho, dimensões e ausência de animações) e cria URLs de objeto efêmeras (`URL.createObjectURL`). Remover ou cancelar o envio não gera nenhuma requisição de rede, read, write ou upload no Firebase.
2. **Processamento Server-Side e Descarte do Original**: O cliente envia os bytes via chamada segura autenticada. O backend reencoda a imagem em WebP (qualidade 80 para versão principal, qualidade 70 para miniatura), remove metadados/EXIF e **nunca** armazena o arquivo original.
3. **Download Sob Demanda e Lazy-Loading**:
   - As miniaturas só são carregadas quando próximas da viewport via `IntersectionObserver` (`rootMargin: '180px'`).
   - A imagem ampliada (versão principal) só é baixada quando o usuário clica expressamente para abrir o visualizador.
4. **Cache em Memória por Conversa**: `createPrivateImageCache` armazena os Blobs em memória durante a visualização do chamado. Reabrir a mesma imagem ou navegar repetidamente pelo carrossel não gera novas chamadas HTTP ou downloads. Ao fechar a conversa ou trocar de chamado, todos os Object URLs são liberados com `URL.revokeObjectURL()`.
5. **Independência de Histórico ($O(1)$)**: A abertura de chamados, o envio de mensagens e as validações operam em escopo estrito $O(1)$, independentemente do tamanho do histórico existente, número total de usuários ou quantidade de chamados no banco de dados.
6. **Reutilização da Rotina Diária de Manutenção**: A expiração de anexos (15 dias após resolução) e a limpeza de operações incompletas (24h) aproveitam o Cloud Scheduler diário existente (`executarRotinaDiariaManutencao`), sem criar novos schedulers ou triggers adicionais.

---

## 2. Métricas Medidas na Implementação Real (Benchmark Instrumentado)

Os números abaixo foram extraídos diretamente da execução instrumentada do serviço de suporte (`scripts/benchmark-support.mjs` e `tests/support.test.mjs`):

### Fixture de Teste Utilizada no Benchmark
- **Imagem Original**: PNG de 384.056 bytes (384 KB), resolução 2560x1621 px.
- **Versão Principal Gerada (WebP Q80)**: 119.156 bytes (119 KB) — redução de **69,0%**.
- **Thumbnail Gerada (WebP Q70)**: 7.638 bytes (7,6 KB, 480x304 px) — redução de **98,0%**.

---

### Tabela de Custos Operacionais por Envio

| Cenário | Imagens | Histórico Prévio | Firestore Reads | Firestore Writes | Invocação Functions | Processamento Sharp | Storage Writes | Armazenamento Total (Bytes) | Transferência Miniatura (Bytes) | Transferência Imagem Aberta (Bytes) | Retry (Reads/Writes) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Mensagem sem Imagem** | 0 | 0 msgs | **3** | **2** | **1** (`finalize`) | **0** | **0** | **0 B** | **0 B** | **0 B** | 3 / 0 |
| **Mensagem sem Imagem** | 0 | 1000 msgs | **3** | **2** | **1** (`finalize`) | **0** | **0** | **0 B** | **0 B** | **0 B** | 3 / 0 |
| **Mensagem com 1 Imagem** | 1 | 0 msgs | **13** | **7** | **3** (`reserve`, `upload`, `finalize`) | **1** | **2** (`img` + `thumb`) | **126.794 B** (~124 KB) | **7.638 B** (~7,5 KB) | **119.156 B** (~116 KB) | 3 / 0 |
| **Mensagem com 1 Imagem** | 1 | 1000 msgs | **13** | **7** | **3** (`reserve`, `upload`, `finalize`) | **1** | **2** (`img` + `thumb`) | **126.794 B** (~124 KB) | **7.638 B** (~7,5 KB) | **119.156 B** (~116 KB) | 3 / 0 |
| **Mensagem com 3 Imagens** | 3 | 0 msgs | **21** | **11** | **5** (`reserve`, 3x `upload`, `finalize`) | **3** (seq) | **6** (3x `img` + 3x `thumb`) | **380.382 B** (~371 KB) | **22.914 B** (~22,4 KB) | **357.468 B** (~349 KB) | 3 / 0 |
| **Mensagem com 3 Imagens** | 3 | 1000 msgs | **21** | **11** | **5** (`reserve`, 3x `upload`, `finalize`) | **3** (seq) | **6** (3x `img` + 3x `thumb`) | **380.382 B** (~371 KB) | **22.914 B** (~22,4 KB) | **357.468 B** (~349 KB) | 3 / 0 |

> **Nota sobre $O(1)$**: Observe que a coluna com 1.000 mensagens históricas apresenta exatamente o mesmo número de leituras, escritas e invocações do que a conversa vazia. O custo de publicação não degrada com o uso contínuo.

---

## 3. Detalhamento de Operações por Fluxo

### 3.1 Abertura de Conversa (`useSupportConversation`)
- **Firestore Reads**:
  - 1 leitura de documento para o chamado: `system_feedback/{ticketId}`.
  - 1 consulta limitada para as últimas 50 mensagens: `query(collection(ticket, 'messages'), orderBy('timestamp', 'desc'), limit(50))`. Total: $1 + N$ reads (onde $N \le 50$).
- **Firestore Writes**:
  - 0 writes no fluxo padrão de leitura.
  - Se houver mensagem não lida (`unreadUser` ou `unreadAdmin` for `true`), a ação `presence` efetua exatamente **1 write** para marcar como lido.
- **Listeners**:
  - Exatamente **2 listeners**: 1 no documento do chamado e 1 na subcoleção de mensagens (com `limit(50)`).
  - Não há listeners por anexo ou por mensagem individual.
  - Ao fechar o modal ou trocar de ticket, os callbacks `unsubscribe()` desligam os listeners imediatamente.
- **Paginação de Histórico**:
  - O botão "Carregar mensagens anteriores" executa uma consulta única por cursor (`startAfter(cursor), limit(50)`), consumindo apenas os reads da página requisitada.

### 3.2 Indicadores Efêmeros de Presença e Digitação
- **Digitação (`typing`)**: Gerenciado via `createTypingTransitions`.
  - Não gera writes por caractere digitado.
  - As transições são ordenadas em fila assíncrona; apenas mudanças reais de estado (`false -> true` no início e `true -> false` após 2 segundos de inatividade ou envio) gravam no Firestore.
- **Fechamento do Componente**: O cleanup do efeito cancela timers e envia `typing: false` se o usuário estava digitando.

### 3.3 Edição de Mensagens
- A edição altera exclusivamente o campo `{ text }` da mensagem.
- Os anexos já existentes (`attachments: [...]`), metadados e referências no Storage são preservados integralmente sem necessidade de reprocessamento, regravação de arquivos ou consumo adicional de cota de imagens.
- Se a mensagem original possuía anexos, o texto pode ser limpo ou atualizado livremente.

### 3.4 Reabertura e Expiração de Imagens
- **Resolução do Chamado**: Admin marca como `resolvido` -> `attachmentsExpireAt` é agendado para `now + 15 dias`.
- **Durante os 15 Dias**: Leitura de thumbnails e imagens ampliadas permanece ativa para o dono e administradores autorizados.
- **Após os 15 Dias**: O endpoint `readSupportAttachment` rejeita requisições imediatamente (HTTP 404). O frontend exibe o aviso "Imagem expirada".
- **Rotina Diária de Manutenção**:
  - Remove fisicamente os arquivos WebP do Storage em lotes indexados de até 100 documentos (`maintenanceBatch: 100`).
  - O texto da conversa permanece intacto para histórico e auditoria.
- **Reabertura Antes da Expiração**: Remove o prazo (`attachmentsExpireAt: null`), mantendo os arquivos intactos.
- **Reabertura Após a Expiração**: O marco `attachmentsExpiredThrough` impede a ressurreição indevida de arquivos já excluídos.

---

## 4. Segurança e Regras do Firebase

1. **Storage Rules (`storage.rules`)**:
   ```javascript
   match /support_attachments/{allPaths=**} {
     allow read, write: if false;
   }
   ```
   O bucket é **100% blindado contra leitura e escrita direta de clientes**. Nenhuma URL pública ou token persistente é gerado. A leitura ocorre exclusivamente através da HTTP Cloud Function autenticada `readSupportAttachment`.

2. **Firestore Rules (`firestore.rules`)**:
   - `system_feedback`: Leitura restrita ao dono autenticado (`resource.data.uid == request.auth.uid`) ou administrador (`isAdmin()`), com `limit <= 100`. Escritas diretas (`create`, `update`, `delete`) são bloqueadas (`allow: if false`).
   - `system_feedback/{id}/messages`: Leitura restrita com `limit <= 50`, garantindo que o chamado não esteja marcado como excluído. Escritas diretas são bloqueadas.
   - Coleções auxiliares (`support_operations`, `support_quotas`, `support_cleanup`): Bloqueadas para clientes via regra padrão deny-all.

3. **Configuração de Cloud Functions (`functions/support/functions.js`)**:
   - Região: `us-central1`
   - Instâncias: `minInstances: 0`, `maxInstances: 2` (custo mínimo em repouso e prevenção de escalonamento excessivo).
   - Memória: `512MiB`, Timeout: `120s`.
   - Concorrência de upload de anexos: `concurrency: 1` por instância, serializando decodificação e processamento com Sharp.
