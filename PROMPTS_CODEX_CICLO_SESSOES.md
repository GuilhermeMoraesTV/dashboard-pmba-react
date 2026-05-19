# Prompts Codex — Sistema de Sessões do Ciclo de Estudos

Estes prompts devem ser executados **em ordem**. Cada um é independente mas depende do anterior.

---

## PROMPT 1 — `useCiclos.jsx`: Nova estrutura de sessões

```
Você está modificando o hook `useCiclos.jsx` de um app React + Firebase (Firestore) para adicionar suporte a sessões de estudo com tempo fixo por sessão, em vez de carga horária semanal total por disciplina.

### CONTEXTO DO SISTEMA ATUAL

O ciclo tem:
- `cargaHorariaSemanalTotal` (horas/semana) no documento raiz do ciclo
- Subcoleção `disciplinas` com campos: `nome`, `peso` (1-5), `tempoAlocadoSemanalMinutos`, `assuntos[]`, `index`
- A função `calcularDistribuicao()` distribui minutos proporcionalmente ao peso de cada disciplina
- Métodos: `criarCiclo`, `editarCiclo`, `ativarCiclo`, `desativarCiclo`, `arquivarCiclo`, `concluirCicloSemanal`, `excluirCicloPermanente`

### O QUE MUDA

**1. Novo campo global no ciclo: `tempoSessaoMinutos`**
- É definido pelo usuário na criação (ex: 25, 30, 45, 50, 60, 90 minutos)
- Salvo no documento raiz do ciclo junto com os outros campos
- Padrão: 50 minutos se não informado

**2. Novo campo calculado por disciplina: `sessoesPorCiclo`**
- Calculado como: `Math.max(1, Math.round(tempoAlocadoMinutos / tempoSessaoMinutos))`
- Salvo na subcoleção `disciplinas` junto com os outros campos
- Exemplo: disciplina com 180min alocados e sessões de 50min → `Math.round(180/50)` = 4 sessões

**3. Novo campo no documento raiz do ciclo: `totalSessoesCiclo`**
- Soma de `sessoesPorCiclo` de todas as disciplinas
- Ex: 4 + 2 + 3 = 9 sessões totais no ciclo

**4. Novo campo no documento raiz do ciclo: `ordemSessoes`**
- Array de objetos que define a sequência das sessões no ciclo
- Gerado por `gerarOrdemSessoes(disciplinas, sessoesPorCiclo)` (função auxiliar abaixo)
- Cada item: `{ disciplinaId, sessaoIndex }` onde `sessaoIndex` é 0-based dentro da disciplina
- Exemplo com Disc A (4 sessões), Disc B (2 sessões), Disc C (3 sessões):
  `[{A,0},{B,0},{C,0},{A,1},{B,1},{C,1},{A,2},{C,2},{A,3}]`
- A distribuição é intercalada (round-robin por peso), não sequencial por disciplina

**5. Novo campo no documento raiz do ciclo: `sessoesConcluidas`**
- Array de índices globais (0-based) das sessões já concluídas neste ciclo atual
- Inicia como `[]`
- Quando `sessoesConcluidas.length === totalSessoesCiclo`, o ciclo está completo

**6. Mudança em `concluirCicloSemanal` → renomear para `concluirVoltaCiclo`**
- Ao concluir (todas sessões feitas), incrementa `conclusoes`
- Chama `gerarOrdemSessoes` com embaralhamento: gera nova `ordemSessoes` diferente da anterior (embaralha mantendo a distribuição round-robin — não embaralhamento aleatório puro, mas rotação: começa da disciplina seguinte ao início anterior)
- Reseta `sessoesConcluidas` para `[]`
- Preserva todo o resto (disciplinas, histórico de conclusoes)

### FUNÇÃO AUXILIAR — `gerarOrdemSessoes(disciplinas, embaralharOffset = 0)`

```javascript
// Recebe array de disciplinas (com id e sessoesPorCiclo)
// Retorna array intercalado de { disciplinaId, sessaoIndex }
// embaralharOffset: qual disciplina começa (0 = primeira, 1 = segunda, etc.)
function gerarOrdemSessoes(disciplinas, embaralharOffset = 0) {
  const ordem = [];
  // Expande cada disciplina em slots individuais com seu índice
  const slots = disciplinas.flatMap(d =>
    Array.from({ length: d.sessoesPorCiclo }, (_, i) => ({ disciplinaId: d.id, sessaoIndex: i }))
  );
  // Round-robin: distribui intercalando disciplinas
  const maxSessoes = Math.max(...disciplinas.map(d => d.sessoesPorCiclo));
  const discsOrdenadas = [...disciplinas];
  // Rotação do offset de embaralhamento
  if (embaralharOffset > 0) {
    const offset = embaralharOffset % discsOrdenadas.length;
    const rotacionadas = [
      ...discsOrdenadas.slice(offset),
      ...discsOrdenadas.slice(0, offset)
    ];
    discsOrdenadas.splice(0, discsOrdenadas.length, ...rotacionadas);
  }
  for (let round = 0; round < maxSessoes; round++) {
    for (const disc of discsOrdenadas) {
      if (round < disc.sessoesPorCiclo) {
        ordem.push({ disciplinaId: disc.id, sessaoIndex: round });
      }
    }
  }
  return ordem;
}
```

### MUDANÇAS EM `calcularDistribuicao`

A função existente continua igual mas recebe `tempoSessaoMinutos` e adiciona o cálculo de `sessoesPorCiclo` em cada disciplina:

```javascript
const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos, tempoSessaoMinutos = 50) => {
  // ... lógica existente de calcular tempoAlocadoMinutos por peso ...
  return disciplinas.map(disciplina => {
    const peso = Number(disciplina.peso) || 1;
    const tempoAlocadoMinutos = Math.round(peso * tempoPorPonto);
    const sessoesPorCiclo = Math.max(1, Math.round(tempoAlocadoMinutos / tempoSessaoMinutos));
    return { ...disciplina, tempoAlocadoMinutos, sessoesPorCiclo };
  });
};
```

### MUDANÇAS EM `criarCiclo`

`cicloData` passa a incluir `tempoSessaoMinutos`. Adicionar ao `batch.set` do documento raiz:

```javascript
batch.set(cicloRef, {
  // ... campos existentes ...
  tempoSessaoMinutos: Number(cicloData.tempoSessaoMinutos) || 50,
  totalSessoesCiclo: disciplinasComTempo.reduce((acc, d) => acc + d.sessoesPorCiclo, 0),
  ordemSessoes: gerarOrdemSessoes(disciplinasComTempo),
  sessoesConcluidas: [],
  embaralharOffset: 0,
});
```

Na subcoleção `disciplinas`, adicionar `sessoesPorCiclo`:

```javascript
batch.set(disciplinaRef, {
  // ... campos existentes ...
  sessoesPorCiclo: disciplina.sessoesPorCiclo,
});
```

### MUDANÇAS EM `editarCiclo`

Aceita `cicloData.tempoSessaoMinutos` e recalcula `sessoesPorCiclo`, `totalSessoesCiclo`, `ordemSessoes`. Reseta `sessoesConcluidas` para `[]` ao editar (pois a estrutura mudou).

### NOVO MÉTODO: `concluirVoltaCiclo(cicloId)`

Substitui `concluirCicloSemanal`. Faz:
1. Busca `cicloDoc` para pegar `conclusoes`, `embaralharOffset`, e `disciplinas` (via getDocs da subcoleção)
2. Incrementa `conclusoes`
3. Calcula `novoOffset = (embaralharOffset + 1) % totalDisciplinas`
4. Gera nova `ordemSessoes = gerarOrdemSessoes(disciplinas, novoOffset)`
5. Reseta `sessoesConcluidas: []`
6. Atualiza `embaralharOffset: novoOffset`
7. Mantém lógica existente de marcar `conclusaoId` nos registrosEstudo

### NOVO MÉTODO: `marcarSessaoConcluida(cicloId, sessaoGlobalIndex)`

```javascript
const marcarSessaoConcluida = async (cicloId, sessaoGlobalIndex) => {
  const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
  const cicloDoc = await getDoc(cicloRef);
  const data = cicloDoc.data();
  const concluidas = data.sessoesConcluidas || [];
  if (concluidas.includes(sessaoGlobalIndex)) {
    // Toggle: desmarca
    await updateDoc(cicloRef, {
      sessoesConcluidas: concluidas.filter(i => i !== sessaoGlobalIndex)
    });
  } else {
    // Marca como concluída
    const novasConcluidas = [...concluidas, sessaoGlobalIndex];
    await updateDoc(cicloRef, { sessoesConcluidas: novasConcluidas });
  }
  return true;
};
```

### NOVO MÉTODO: `agendarRevisaoCiclo(dados)`

Cria documento na coleção `users/{uid}/revisoesCiclo`:

```javascript
const agendarRevisaoCiclo = async ({ cicloId, disciplinaId, disciplinaNome, assunto, intervaloDias, sessaoGlobalIndex }) => {
  const dataAgendada = new Date();
  dataAgendada.setDate(dataAgendada.getDate() + intervaloDias);
  const dataStr = dataAgendada.toISOString().split('T')[0];
  
  const revisaoRef = doc(collection(db, 'users', user.uid, 'revisoesCiclo'));
  await setDoc(revisaoRef, {
    cicloId,
    disciplinaId,
    disciplinaNome,
    assunto,
    dataAgendada: dataStr,
    intervaloDias,
    sessaoOrigem: sessaoGlobalIndex,
    concluida: false,
    criadaEm: serverTimestamp(),
  });
  return revisaoRef.id;
};
```

### RETORNO DO HOOK

Adicionar ao objeto retornado:
- `marcarSessaoConcluida`
- `concluirVoltaCiclo` (substitui `concluirCicloSemanal`, mas manter o nome antigo como alias por compatibilidade)
- `agendarRevisaoCiclo`

### REGRAS ABSOLUTAS

- Não quebrar nenhum método existente — apenas adicionar campos e métodos
- Manter `concluirCicloSemanal` como alias de `concluirVoltaCiclo`
- Todo o design system visual existente deve ser preservado integralmente
- Não alterar nenhuma outra parte do app
```

---

## PROMPT 2 — `CicloCreateWizard.jsx`: Seletor de tempo de sessão

```
Você está modificando `CicloCreateWizard.jsx` para adicionar a seleção do tempo de cada sessão de estudo. Este é um wizard multi-step em React com Framer Motion, Tailwind CSS e design dark/light com acentos vermelhos (`red-600`).

### CONTEXTO DO ARQUIVO

O wizard tem 3 passos:
- Passo 1: Tipo do ciclo (manual ou por edital)
- Passo 2: Carga horária (grade de horários ou manual)
- Passo 3: Disciplinas (lista com drag & drop, radar visual à direita)

O estado atual relevante:
```javascript
const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('grade');
const [cargaHorariaManual, setCargaHorariaManual] = useState(0);
const [gradeDisponibilidade, setGradeDisponibilidade] = useState({});
```

### O QUE ADICIONAR

**1. Novo estado: `tempoSessaoMinutos`**

```javascript
const [tempoSessaoMinutos, setTempoSessaoMinutos] = useState(50);
```

**2. No Passo 2 (carga horária), após o bloco da grade/manual de horas, adicionar:**

Uma seção "Duração de cada sessão" com opções rápidas clicáveis + campo numérico livre.

```jsx
{/* SEÇÃO: Duração da sessão */}
<div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mt-4">
  <div className="flex items-center gap-2 mb-3">
    <Clock size={16} className="text-zinc-400" />
    <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
      Duração de cada sessão
    </span>
  </div>
  
  {/* Opções rápidas */}
  <div className="flex flex-wrap gap-2 mb-3">
    {[25, 30, 45, 50, 60, 90].map((min) => (
      <button
        key={min}
        type="button"
        onClick={() => setTempoSessaoMinutos(min)}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
          tempoSessaoMinutos === min
            ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-red-300'
        }`}
      >
        {min}min
      </button>
    ))}
  </div>
  
  {/* Campo livre */}
  <div className="flex items-center gap-2">
    <span className="text-xs text-zinc-500">Ou defina:</span>
    <input
      type="number"
      min={10}
      max={180}
      value={tempoSessaoMinutos}
      onChange={(e) => setTempoSessaoMinutos(Math.max(10, Math.min(180, Number(e.target.value))))}
      className="w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm font-bold text-zinc-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-red-500"
    />
    <span className="text-xs text-zinc-400">minutos por sessão</span>
  </div>
</div>
```

**3. No Passo 3, no componente `ItemDisciplina`, adicionar badge de sessões:**

No `ItemDisciplina`, o campo `disciplina.horasCalculadas` já existe. Agora precisa também mostrar o número de sessões. Passe `tempoSessaoMinutos` como prop para `ItemDisciplina` e adicione ao badge existente:

```jsx
// No lugar do badge atual que mostra só horas:
<div className="text-right">
  <span className="block text-xs font-black text-zinc-800 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
    {formatarHoras(disciplina.horasCalculadas)}
  </span>
  <span className="block text-[10px] font-bold text-zinc-400 mt-0.5">
    {Math.max(1, Math.round((disciplina.horasCalculadas * 60) / tempoSessaoMinutos))} sessões de {tempoSessaoMinutos}min
  </span>
</div>
```

**4. No `RadarCiclo` (passo 3, sidebar direita), adicionar linha de resumo:**

Abaixo do "Total Horas", adicionar:
```jsx
<div className="flex justify-between items-end mt-2">
  <span className="text-xs font-bold text-zinc-500 uppercase">Total sessões</span>
  <span className="text-xl font-black text-zinc-600 dark:text-zinc-300">
    {disciplinasComCalculo.reduce((acc, d) =>
      acc + Math.max(1, Math.round((d.horasCalculadas * 60) / tempoSessaoMinutos)), 0
    )}
  </span>
</div>
<div className="flex justify-between items-end">
  <span className="text-xs font-bold text-zinc-500 uppercase">Duração</span>
  <span className="text-sm font-bold text-zinc-500">{tempoSessaoMinutos}min/sessão</span>
</div>
```

**5. Em `finalizarCriacao`, passar `tempoSessaoMinutos` para `criarCiclo`:**

```javascript
const novoCicloId = await criarCiclo({
  // ... dados existentes ...
  tempoSessaoMinutos,
});
```

**6. Em `selecionarModelo`, NÃO alterar o `tempoSessaoMinutos` — manter o valor do state atual.**

### REGRAS ABSOLUTAS

- Não alterar nenhum outro passo do wizard
- Manter exatamente o mesmo design: rounded-2xl, border zinc-200/dark:zinc-800, red-600 como acento, fonte bold uppercase para labels
- Manter todas as animações Framer Motion existentes
- Não tocar em `GradeHorarios.jsx` nem em `ModalSelecaoEdital.jsx`
- Não alterar a lógica de `selecionarModelo` exceto o que está especificado
- ItemDisciplina recebe `tempoSessaoMinutos` como nova prop opcional (com default 50)
```

---

## PROMPT 3 — `ItemDisciplina.jsx`: Suporte a `tempoSessaoMinutos`

```
Você está modificando `ItemDisciplina.jsx` para exibir o número de sessões calculadas por disciplina.

### CONTEXTO

`ItemDisciplina` é um card expandível que representa uma disciplina no wizard de criação de ciclo. Ele já exibe `disciplina.horasCalculadas` como um badge.

### MUDANÇA ÚNICA

Adicionar `tempoSessaoMinutos` como nova prop opcional (default 50):

```javascript
const ItemDisciplina = ({
  // ... props existentes ...
  tempoSessaoMinutos = 50,
}) => {
```

No bloco do badge de horas (próximo à linha `formatarHoras(disciplina.horasCalculadas)`), adicionar logo abaixo do badge existente:

```jsx
<div className="text-right">
  <span className="block text-xs font-black text-zinc-800 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
    {formatarHoras(disciplina.horasCalculadas)}
  </span>
  <span className="block text-[10px] font-semibold text-zinc-400 mt-0.5 text-right">
    {Math.max(1, Math.round((disciplina.horasCalculadas * 60) / tempoSessaoMinutos))} sessões
  </span>
</div>
```

### REGRAS ABSOLUTAS

- Nenhuma outra linha do arquivo deve ser alterada
- Manter todo o design visual existente
- A prop é opcional com default 50, para não quebrar outros usos do componente
```

---

## PROMPT 4 — `CicloVisual.jsx`: Redesenho para sessões (CRÍTICO — design preservado)

```
Você está modificando `CicloVisual.jsx` para trocar o modelo de exibição de "carga horária semanal por disciplina" para "sessões individuais do ciclo". 

### ⚠️ REGRA MAIS IMPORTANTE DESTE PROMPT

**O design visual e o sistema de componentes DEVEM ser preservados integralmente:**
- A roda (gráfico SVG circular com `CicloSegment`) DEVE continuar existindo
- `WeeklyProgressRing` (anel interno de progresso) DEVE continuar
- `CicloConcluídoCenter` (overlay de ciclo completo) DEVE continuar
- Animações Framer Motion DEVEM continuar
- O painel lateral de detalhes DEVE continuar
- Cores: zinc-800/900 dark, white light, red-600 acento, emerald-500 sucesso
- Fontes: font-black uppercase para métricas, font-bold para labels
- Bordas: rounded-2xl, border-zinc-200 dark:border-zinc-800
- Sombras: shadow-xl, shadow-emerald-500/40 para estados de sucesso

### CONTEXTO DO ARQUIVO ATUAL

Props atuais de `CicloVisual`:
```javascript
function CicloVisual({
  selectedDisciplinaId,
  onSelectDisciplina,
  onViewDetails,
  onStartStudy,
  disciplinas,
  registrosEstudo,
  viewMode,
  ciclo,
  isLoading,
  canConcludeCiclo,
  onConcluirCiclo,
  cicloActionLoading,
})
```

O `useMemo` chamado `data` atual calcula:
- `metaMinutos`, `progressMinutos`, `percentage`, `startAngle`, `angle`, `color` por disciplina
- `color` é zinc (#71717a) se 0%, emerald (#10b981) se 100%, yellow (#eab308) se entre

O componente atual tem dois grandes blocos:
1. Área do gráfico SVG (roda)
2. Painel lateral de detalhes (aparece ao hover/click em segmento)

### NOVA LÓGICA DE DADOS

**O ciclo agora tem:**
- `ciclo.ordemSessoes`: array de `{ disciplinaId, sessaoIndex }` (a sequência das sessões)
- `ciclo.sessoesConcluidas`: array de índices globais (0-based) das sessões concluídas
- `ciclo.tempoSessaoMinutos`: tempo de cada sessão
- `ciclo.totalSessoesCiclo`: total de sessões no ciclo

**Cada disciplina em `disciplinas` agora tem:**
- `sessoesPorCiclo`: número de sessões desta disciplina no ciclo
- `tempoAlocadoSemanalMinutos`: mantido para compatibilidade

### MUDANÇA 1: Novo `useMemo` para calcular dados de sessões

Substituir o `useMemo` de `data` atual por este novo:

```javascript
const data = useMemo(() => {
  if (!disciplinas.length || !ciclo?.ordemSessoes?.length) return [];

  const ordemSessoes = ciclo.ordemSessoes || [];
  const sessoesConcluidas = new Set(ciclo.sessoesConcluidas || []);
  const tempoSessao = ciclo.tempoSessaoMinutos || 50;

  // Calcula ângulo de cada sessão (todas iguais — cada sessão = 1/N do círculo)
  const totalSessoes = ordemSessoes.length;
  const anguloPorSessao = totalSessoes > 0 ? 360 / totalSessoes : 0;

  // Paleta de cores por disciplina (mantém lógica de cores existente)
  const coresDisciplinas = {};
  const palette = ['#e11d48','#2563eb','#059669','#d97706','#7c3aed','#db2777','#0891b2','#ea580c','#0d9488','#65a30d'];
  disciplinas.forEach((d, i) => { coresDisciplinas[d.id] = palette[i % palette.length]; });

  let currentAngle = 0;

  return ordemSessoes.map((sessao, globalIndex) => {
    const disciplina = disciplinas.find(d => d.id === sessao.disciplinaId);
    if (!disciplina) return null;

    const concluida = sessoesConcluidas.has(globalIndex);
    
    // Cor baseada no estado: concluída = emerald, não concluída = cor da disciplina
    const corBase = coresDisciplinas[disciplina.id] || '#71717a';
    const color = concluida ? '#10b981' : corBase;

    const segmentData = {
      key: `sessao-${globalIndex}`,
      globalIndex,
      disciplina,
      sessaoIndex: sessao.sessaoIndex, // índice dentro da disciplina (0, 1, 2...)
      concluida,
      startAngle: currentAngle,
      angle: anguloPorSessao,
      color,
      corBase,
      metaMinutos: tempoSessao,     // mantém compatibilidade com CicloSegment
      progressMinutos: concluida ? tempoSessao : 0, // mantém compatibilidade
      percentage: concluida ? 100 : 0,
    };

    currentAngle += anguloPorSessao;
    return segmentData;
  }).filter(Boolean);
}, [disciplinas, ciclo]);
```

### MUDANÇA 2: Fallback para ciclos sem `ordemSessoes` (retrocompatibilidade)

Antes do `useMemo` de `data`, adicionar:

```javascript
// Detecta se é ciclo novo (com sessões) ou ciclo legado (por carga horária)
const isModoCicloSessoes = !!(ciclo?.ordemSessoes?.length);
```

Se `!isModoCicloSessoes`, o componente deve renderizar com a lógica antiga (mantém o `useMemo` antigo renomeado para `dataLegado`).

### MUDANÇA 3: Duas views — ciclo completo e por disciplina

Adicionar estado local:

```javascript
const [viewCiclo, setViewCiclo] = useState('completo'); // 'completo' | 'disciplina'
const [disciplinaFocada, setDisciplinaFocada] = useState(null); // id da disciplina
```

Adicionar toggle acima da roda:

```jsx
<div className="flex items-center gap-2 mb-4 justify-center">
  <button
    onClick={() => { setViewCiclo('completo'); setDisciplinaFocada(null); }}
    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
      viewCiclo === 'completo'
        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md'
        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
    }`}
  >
    Ciclo completo
  </button>
  <button
    onClick={() => setViewCiclo('disciplina')}
    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
      viewCiclo === 'disciplina'
        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md'
        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
    }`}
  >
    Por disciplina
  </button>
</div>
```

**Lógica do `data` para view "por disciplina":**

Quando `viewCiclo === 'disciplina'` e `disciplinaFocada !== null`:
- Filtra `data` para mostrar apenas as sessões da disciplina selecionada
- O ângulo é redistribuído: `360 / sessoesDaDisciplina.length`

Quando `viewCiclo === 'disciplina'` e `disciplinaFocada === null`:
- Exibe uma "roda de disciplinas" — um segmento por disciplina, ângulo proporcional ao `sessoesPorCiclo`
- Ao clicar em um segmento, seta `disciplinaFocada` e muda para mostrar só as sessões daquela disciplina
- Adicionar botão "Voltar" quando `disciplinaFocada !== null`

Implementar como `useMemo` separado `dataViewAtual` que combina a lógica:

```javascript
const dataViewAtual = useMemo(() => {
  if (!isModoCicloSessoes) return data; // legado

  if (viewCiclo === 'completo') return data;

  if (viewCiclo === 'disciplina' && !disciplinaFocada) {
    // Uma fatia por disciplina, proporcionais ao sessoesPorCiclo
    const totalSessoes = ciclo.totalSessoesCiclo || data.length;
    let currentAngle = 0;
    return disciplinas.map((disc, i) => {
      const sessoesDisc = data.filter(s => s.disciplina.id === disc.id);
      const concluidasDisc = sessoesDisc.filter(s => s.concluida).length;
      const totalDisc = disc.sessoesPorCiclo || sessoesDisc.length;
      const angulo = totalSessoes > 0 ? (totalDisc / totalSessoes) * 360 : 0;
      const percentage = totalDisc > 0 ? (concluidasDisc / totalDisc) * 100 : 0;
      const color = percentage === 100 ? '#10b981' : percentage > 0 ? '#eab308' : '#71717a';
      const seg = {
        key: `disc-${disc.id}`,
        globalIndex: -1,
        disciplina: disc,
        sessaoIndex: -1,
        concluida: percentage === 100,
        startAngle: currentAngle,
        angle: angulo,
        color,
        corBase: color,
        metaMinutos: totalDisc * (ciclo.tempoSessaoMinutos || 50),
        progressMinutos: concluidasDisc * (ciclo.tempoSessaoMinutos || 50),
        percentage,
        isDisciplinaAgregada: true,
        totalSessoesDisciplina: totalDisc,
        concluidasDisciplina: concluidasDisc,
      };
      currentAngle += angulo;
      return seg;
    });
  }

  if (viewCiclo === 'disciplina' && disciplinaFocada) {
    // Só as sessões da disciplina focada
    const sessoesDisc = data.filter(s => s.disciplina.id === disciplinaFocada);
    const angulo = sessoesDisc.length > 0 ? 360 / sessoesDisc.length : 0;
    let currentAngle = 0;
    return sessoesDisc.map(s => {
      const seg = { ...s, startAngle: currentAngle, angle: angulo };
      currentAngle += angulo;
      return seg;
    });
  }

  return data;
}, [data, viewCiclo, disciplinaFocada, disciplinas, ciclo, isModoCicloSessoes]);
```

### MUDANÇA 4: Cálculos de progresso geral (atualizar para usar `data`)

Substituir os cálculos existentes de `totalEstudado`, `totalMeta`, `progressoGeral`:

```javascript
const totalSessoes = isModoCicloSessoes ? data.length : data.reduce((acc, d) => acc + d.metaMinutos, 0);
const sessoesConcluidas = isModoCicloSessoes ? data.filter(s => s.concluida).length : data.reduce((acc, d) => acc + d.progressMinutos, 0);
const progressoGeral = totalSessoes > 0 ? (sessoesConcluidas / totalSessoes) * 100 : 0;

// Para o centro da roda (manter compatibilidade visual)
const totalEstudado = isModoCicloSessoes
  ? sessoesConcluidas * (ciclo?.tempoSessaoMinutos || 50)
  : data.reduce((acc, d) => acc + d.progressMinutos, 0);
const totalMeta = isModoCicloSessoes
  ? totalSessoes * (ciclo?.tempoSessaoMinutos || 50)
  : data.reduce((acc, d) => acc + d.metaMinutos, 0);
```

### MUDANÇA 5: Texto central da roda (modo sessões)

No `foreignObject` central (o `key="center-info"`), quando `!activeDisciplina` e `isModoCicloSessoes`:

```jsx
<span className="text-[3.5px] md:text-[2.7px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-1">
  SESSÕES
</span>
<div className="flex items-baseline justify-center gap-[1px]">
  <span className="text-[10px] md:text-[9.5px] font-black text-zinc-800 dark:text-white leading-none tracking-tighter">
    {sessoesConcluidas}
  </span>
  <span className="text-[5px] text-zinc-400 font-bold">/{totalSessoes}</span>
</div>
<div className="w-6 h-[0.5px] bg-zinc-300 dark:bg-zinc-700 my-1"></div>
<span className="text-[3.5px] md:text-[3.2px] font-bold text-zinc-400 uppercase tracking-wide">
  {Math.round(progressoGeral)}% completo
</span>
```

### MUDANÇA 6: Painel lateral — modo sessões

Quando `activeDisciplina` existe e `isModoCicloSessoes`:

Se `activeDisciplina.isDisciplinaAgregada` (clicou na view por disciplina no nível de disciplinas):
- Mostrar: nome da disciplina, total de sessões, sessões concluídas, botão "Ver sessões desta disciplina" que seta `disciplinaFocada`
- Manter o mesmo layout de painel existente (bg-zinc-50 dark:bg-zinc-900, rounded-2xl, border, shadow-xl)

Se sessão individual:
- Mostrar: nome da disciplina, "Sessão X de N" (onde X = sessaoIndex+1, N = sessoesPorCiclo da disciplina), tempo da sessão, status (concluída/pendente)
- Botão "Iniciar estudo" (chama `onStartStudy(activeDisciplina.disciplina)`)
- Botão "Marcar como concluída" / "Desmarcar" — chama novo callback `onMarcarSessao(globalIndex)`
- Se concluída: mostrar badge verde "Sessão concluída" em vez dos botões

### MUDANÇA 7: Novas props do componente

Adicionar ao destructuring de props:

```javascript
function CicloVisual({
  // ... props existentes mantidas ...
  onMarcarSessao,       // (globalIndex: number) => void
  onConcluirCiclo,      // mantém
  canConcludeCiclo,     // mantém — agora true quando sessoesConcluidas.length === totalSessoesCiclo
})
```

### MUDANÇA 8: `isConcluido`

Atualizar:

```javascript
const isConcluido = isModoCicloSessoes
  ? (ciclo?.sessoesConcluidas?.length || 0) >= (ciclo?.totalSessoesCiclo || Infinity)
  : !!canConcludeCiclo;
```

### MUDANÇA 9: onClick nos segmentos

No modo 'disciplina' sem foco (`disciplinaFocada === null`):
```javascript
onClick={(seg) => {
  if (seg.isDisciplinaAgregada) {
    // Primeiro clique: seleciona a disciplina no painel
    onSelectDisciplina(seg.disciplina.id);
    // Duplo clique ou botão no painel: vai para view de sessões
  }
}}
```

No modo 'completo' ou 'disciplina' com foco:
```javascript
onClick={(seg) => {
  if (seg.globalIndex >= 0) {
    onSelectDisciplina(seg.disciplina.id + '-' + seg.globalIndex);
    // O painel lateral usa activeDisciplina para saber qual sessão mostrar
  }
}}
```

**Importante**: `hoveredId` e `activeDisciplina` devem funcionar com a chave `seg.key` em vez de `disciplina.id` puro, pois agora há múltiplas sessões por disciplina.

### MUDANÇA 10: Botão "Voltar" quando `disciplinaFocada !== null`

```jsx
{disciplinaFocada && viewCiclo === 'disciplina' && (
  <button
    onClick={() => { setDisciplinaFocada(null); onSelectDisciplina(null); }}
    className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white mb-2 transition-colors"
  >
    ← Voltar às disciplinas
  </button>
)}
```

### REGRAS ABSOLUTAS — INVIOLÁVEIS

1. `CicloSegment`, `WeeklyProgressRing`, `CicloConcluídoCenter` — **NÃO ALTERAR** esses subcomponentes. Apenas usá-los como estão.
2. Todo o painel lateral de "ciclo concluído" (com Trophy, botão verde, lista de disciplinas) deve permanecer idêntico ao atual — apenas `isConcluido` muda a lógica de quando ele aparece.
3. Manter `formatVisualHours` exatamente como está.
4. Manter as classes Tailwind existentes para o layout: `flex flex-col xl:flex-row`, `w-[280px] sm:w-[320px] md:w-[420px] lg:w-[500px]`, etc.
5. Manter `AnimatePresence` e `motion.div` em todos os lugares onde já existem.
6. O modo legado (ciclos criados antes desta mudança, sem `ordemSessoes`) deve renderizar normalmente com o código antigo.
7. Não adicionar imports não utilizados.
8. O arquivo pode ficar grande — não encurtar nenhuma seção existente.
```

---

## PROMPT 5 — `ModalRegistroSessao.jsx`: Novo componente de conclusão de sessão + agendamento de revisão

```
Crie o componente `ModalRegistroSessao.jsx` do zero. Este modal aparece quando o usuário marca uma sessão como concluída em um ciclo de estudos. Ele coleta o assunto estudado e pergunta quando o usuário quer revisar.

### DESIGN SYSTEM

Seguir exatamente o mesmo padrão visual dos outros modais do app:
- Overlay: `fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`
- Modal: `bg-white dark:bg-zinc-950 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden`
- Animações: `motion.div` com `initial={{ opacity:0, scale:0.88, y:16 }}` → `animate={{ opacity:1, scale:1, y:0 }}`
- Botão primário: `bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm uppercase tracking-wide shadow-lg shadow-emerald-600/30`
- Botão secundário: `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-xs uppercase`
- Cor de acento: emerald-500 (sucesso/confirmação), não red-600 (que é só para ações destrutivas)

### PROPS

```javascript
function ModalRegistroSessao({
  isOpen,          // boolean
  onClose,         // () => void — chamado ao cancelar ou após confirmar
  sessao,          // { disciplinaNome, sessaoIndex, sessoesPorCiclo, tempoSessaoMinutos, globalIndex }
  onConfirmar,     // ({ assunto, revisao }) => void — chamado ao confirmar
                   // revisao: null | { intervaloDias: 1|7|30 }
})
```

### ESTADO INTERNO

```javascript
const [assunto, setAssunto] = useState('');
const [revisaoEscolhida, setRevisaoEscolhida] = useState(null); // null | 1 | 7 | 30
const [etapa, setEtapa] = useState('assunto'); // 'assunto' | 'revisao'
```

Resetar estado ao abrir (`useEffect` em `isOpen`).

### ESTRUTURA DO MODAL

**Cabeçalho:**
- Ícone de check (CheckCircle2, emerald-500)
- Título: "Sessão concluída!"
- Subtítulo: "{disciplinaNome} · Sessão {sessaoIndex+1}/{sessoesPorCiclo}"

**Etapa 1 — 'assunto':**
- Label: "O que você estudou nesta sessão?"
- Campo de texto (textarea, 3 linhas): placeholder "Ex: Princípios Constitucionais, Art. 5º..."
- Botão: "Continuar →" (ativo sempre, assunto é opcional mas recomendado)
- Texto de apoio: "Registrar o assunto ajuda a programar as revisões certas"

**Etapa 2 — 'revisao':**
- Label: "Quando quer revisar este conteúdo?"
- 4 opções de card clicável:
  - "Amanhã" → intervaloDias: 1, ícone: Clock, cor: blue
  - "Em 7 dias" → intervaloDias: 7, ícone: Calendar, cor: amber  
  - "Em 30 dias" → intervaloDias: 30, ícone: RotateCw, cor: purple
  - "Não precisa revisar" → revisaoEscolhida: 'skip', ícone: X, cor: zinc
- Botão "Confirmar" (emerald-600): confirma e fecha
- Botão "Pular" (zinc, menor, link-style): fecha sem agendar revisão

**Cards de opção de revisão:**
```jsx
<button
  onClick={() => setRevisaoEscolhida(1)}
  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
    revisaoEscolhida === 1
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'
  }`}
>
  <div className="flex items-center gap-3">
    <Clock size={18} className="text-blue-500" />
    <div>
      <p className="text-sm font-bold text-zinc-800 dark:text-white">Amanhã</p>
      <p className="text-xs text-zinc-500">Revisão em 1 dia</p>
    </div>
  </div>
</button>
```

**Lógica de `onConfirmar`:**
```javascript
const handleConfirmar = () => {
  onConfirmar({
    assunto: assunto.trim() || null,
    revisao: revisaoEscolhida && revisaoEscolhida !== 'skip'
      ? { intervaloDias: revisaoEscolhida }
      : null,
  });
  onClose();
};
```

### FLUXO

1. Modal abre → etapa 'assunto'
2. Usuário digita (ou não) → clica "Continuar"
3. Muda para etapa 'revisao'
4. Usuário escolhe opção (ou clica "Pular")
5. Clica "Confirmar" → `onConfirmar` é chamado → modal fecha

Se `assunto` está vazio E o usuário não escolheu revisão e clica "Pular" na etapa 2: chama `onConfirmar({ assunto: null, revisao: null })`.

### IMPORTS NECESSÁRIOS

```javascript
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Calendar, RotateCw, X, ArrowRight } from 'lucide-react';
```
```

---

## PROMPT 6 — `useCicloRevisoes.js`: Hook para revisões do ciclo

```
Crie o hook `useCicloRevisoes.js` do zero. Este hook gerencia as revisões agendadas de sessões de ciclo de estudos, armazenadas na coleção `users/{uid}/revisoesCiclo` no Firestore.

### ESTRUTURA DO DOCUMENTO `revisoesCiclo`

```javascript
{
  cicloId: string,
  disciplinaId: string,
  disciplinaNome: string,
  assunto: string | null,
  dataAgendada: string, // 'YYYY-MM-DD'
  intervaloDias: 1 | 7 | 30,
  sessaoOrigem: number, // globalIndex da sessão que gerou
  concluida: boolean,
  criadaEm: Timestamp,
}
```

### HOOK

```javascript
export const useCicloRevisoes = (user, cicloId) => {
  const [revisoes, setRevisoes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carrega revisões do cicloId ativo (onSnapshot para reatividade)
  useEffect(() => {
    if (!user || !cicloId) return;
    const q = query(
      collection(db, 'users', user.uid, 'revisoesCiclo'),
      where('cicloId', '==', cicloId),
      where('concluida', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRevisoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, cicloId]);

  // Revisões de hoje (inclui atrasadas)
  const revisoesHoje = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return revisoes.filter(r => r.dataAgendada <= hoje);
  }, [revisoes]);

  // Total de revisões pendentes
  const totalPendentes = revisoesHoje.length;

  // Marcar revisão como concluída
  const concluirRevisao = async (revisaoId) => {
    await updateDoc(doc(db, 'users', user.uid, 'revisoesCiclo', revisaoId), {
      concluida: true,
      concluidaEm: serverTimestamp(),
    });
  };

  return { revisoes, revisoesHoje, totalPendentes, loading, concluirRevisao };
};
```

### IMPORTS

```javascript
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
```

### REGRAS

- Zero lógica de UI — apenas dados e operações Firebase
- Reativo: usa `onSnapshot` para atualizar em tempo real
- Só retorna revisões não concluídas (filtro no query)
```

---

## PROMPT 7 — Dashboard: Card de sessões do ciclo de hoje

```
Você está modificando o componente de card de estudo do Dashboard para mostrar as sessões do ciclo do dia atual.

### CONTEXTO

O Dashboard já tem um card que mostra o ciclo ativo. Ele recebe `registrosEstudo`, `activeCicloId`, e provavelmente renderiza uma seção do ciclo ativo.

### O QUE ADICIONAR

Crie um subcomponente `CardSessoesCicloHoje` que pode ser importado e usado no Dashboard.

Este componente recebe:
```javascript
function CardSessoesCicloHoje({ ciclo, disciplinas, onIniciarSessao }) {
```

**Lógica de distribuição diária:**

```javascript
// Quantas sessões por dia da semana (distribui uniformemente)
const sessoesPorDia = useMemo(() => {
  if (!ciclo?.ordemSessoes?.length) return {};
  
  const ordemSessoes = ciclo.ordemSessoes;
  const sessoesConcluidas = new Set(ciclo.sessoesConcluidas || []);
  const totalSessoes = ordemSessoes.length;
  
  // Dias de estudo: usa gradeDisponibilidade do ciclo, ou padrão seg-sex
  // Por simplicidade: distribui N sessões por 5 dias (seg-sex)
  // Em ciclos futuros: usar gradeDisponibilidade salva
  const diasEstudo = 5; // segunda a sexta
  const sessoesPorDiaNum = Math.ceil(totalSessoes / diasEstudo);
  
  // Mapeia por dia da semana (1=Seg, 2=Ter... 5=Sex)
  const mapa = {};
  ordemSessoes.forEach((sessao, globalIndex) => {
    const diaIdx = Math.floor(globalIndex / sessoesPorDiaNum);
    const diaNum = (diaIdx % diasEstudo) + 1; // 1-5
    if (!mapa[diaNum]) mapa[diaNum] = [];
    mapa[diaNum].push({
      ...sessao,
      globalIndex,
      concluida: sessoesConcluidas.has(globalIndex),
    });
  });
  
  return mapa;
}, [ciclo]);

// Sessões de hoje
const sessoesDoDiaHoje = useMemo(() => {
  const hoje = new Date().getDay(); // 0=Dom, 1=Seg...
  const diaEstudo = hoje === 0 || hoje === 6 ? null : hoje; // ignora fds
  if (!diaEstudo) return [];
  return sessoesPorDia[diaEstudo] || [];
}, [sessoesPorDia]);
```

**Layout do card:**

```jsx
<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
  
  {/* Header */}
  <div className="flex items-center justify-between mb-3">
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ciclo de hoje</p>
      <h3 className="text-sm font-black text-zinc-800 dark:text-white">{ciclo.nome}</h3>
    </div>
    <div className="text-right">
      <span className="text-xs font-black text-zinc-800 dark:text-white">
        {sessoesDoDiaHoje.filter(s => s.concluida).length}/{sessoesDoDiaHoje.length}
      </span>
      <p className="text-[10px] text-zinc-400">concluídas</p>
    </div>
  </div>
  
  {/* Barra de progresso do dia */}
  <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3 overflow-hidden">
    <div
      className="h-full bg-emerald-500 rounded-full transition-all"
      style={{ width: `${sessoesDoDiaHoje.length > 0 ? (sessoesDoDiaHoje.filter(s => s.concluida).length / sessoesDoDiaHoje.length) * 100 : 0}%` }}
    />
  </div>
  
  {/* Lista de sessões de hoje */}
  <div className="space-y-2">
    {sessoesDoDiaHoje.map((sessao, idx) => {
      const disc = disciplinas.find(d => d.id === sessao.disciplinaId);
      if (!disc) return null;
      return (
        <div
          key={sessao.globalIndex}
          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
            sessao.concluida
              ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10'
              : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50'
          }`}
        >
          {/* Check icon */}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            sessao.concluida ? 'bg-emerald-500' : 'border-2 border-zinc-300 dark:border-zinc-600'
          }`}>
            {sessao.concluida && <CheckCircle2 size={12} className="text-white" />}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold truncate ${
              sessao.concluida ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-white'
            }`}>
              {disc.nome}
            </p>
            <p className="text-[10px] text-zinc-400">
              Sessão {sessao.sessaoIndex + 1} · {ciclo.tempoSessaoMinutos || 50}min
            </p>
          </div>
          
          {/* Botão iniciar (só se não concluída) */}
          {!sessao.concluida && (
            <button
              onClick={() => onIniciarSessao(disc, sessao.globalIndex)}
              className="shrink-0 px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white transition-all"
            >
              Iniciar
            </button>
          )}
        </div>
      );
    })}
    
    {sessoesDoDiaHoje.length === 0 && (
      <p className="text-xs text-zinc-400 text-center py-4">
        Nenhuma sessão programada para hoje
      </p>
    )}
  </div>
</div>
```

### EXPORTS

```javascript
export default CardSessoesCicloHoje;
```

### IMPORTS NECESSÁRIOS

```javascript
import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
```

### REGRAS

- Não alterar nenhum arquivo existente — apenas criar este componente
- Todo o design segue o padrão: rounded-2xl, border-zinc-200 dark:border-zinc-800, emerald-500 para sucesso, red-600 para ação principal
- Responsivo: funciona em mobile (largura total) e desktop (max-w container)
- Sem dependências novas além das já usadas no projeto (React, lucide-react)
```

---

## RESUMO DE ORDEM E DEPENDÊNCIAS

| Ordem | Arquivo | Depende de |
|-------|---------|------------|
| 1 | `useCiclos.jsx` | Nada (base) |
| 2 | `CicloCreateWizard.jsx` | Prompt 1 |
| 3 | `ItemDisciplina.jsx` | Prompt 2 |
| 4 | `CicloVisual.jsx` | Prompt 1 |
| 5 | `ModalRegistroSessao.jsx` | Novo componente independente |
| 6 | `useCicloRevisoes.js` | Novo hook independente |
| 7 | `CardSessoesCicloHoje` | Prompts 1 e 6 |

## NOTAS FINAIS PARA O CODEX

- **Retrocompatibilidade é obrigatória**: ciclos criados antes desta mudança (sem `ordemSessoes`) devem funcionar normalmente
- **Firebase**: todos os updates usam `updateDoc` com merge — nunca `setDoc` sem `merge: true` em documentos existentes
- **Design**: os prompts 1, 5, 6 e 7 criam arquivos novos — liberdade de estrutura. Os prompts 2, 3 e 4 modificam arquivos existentes — o design deve ser preservado ao pixel
- **CicloVisual.jsx é o mais crítico**: é o componente central, visual e complexo. O Codex deve ler o arquivo original completo antes de modificar
