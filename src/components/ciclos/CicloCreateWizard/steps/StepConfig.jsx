import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, Clock, Edit2, Layers3, LayoutList, Palette, Settings2, Shuffle, Target } from 'lucide-react';

const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const EditalSidebarCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.08)]">
    <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="relative z-10 inline-block px-2.5 py-1 mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
      {editalSelecionado ? 'Edital Alvo' : 'Ciclo Manual'}
    </span>
    <div className="relative z-10 w-28 h-28 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-2 mb-4 shadow-lg shadow-red-500/20">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 w-full">
      <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase leading-tight line-clamp-2">
        {editalSelecionado?.titulo || editalSelecionado?.nome || 'Novo Ciclo'}
      </h3>
      {editalSelecionado?.cargo && (
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-1">
          {editalSelecionado.cargo}
        </p>
      )}
    </div>
  </div>
);

const OPCOES_ASSUNTOS = [
  {
    id: 'guiado',
    label: 'Guiado',
    icon: LayoutList,
    desc: 'Mostra a disciplina e o assunto sugerido em cada bloco.',
    activeBorder: 'border-red-500/50',
    activeBg: 'bg-red-50/40 dark:bg-red-950/10',
    activeBar: 'bg-red-500',
    activeIcon: 'bg-red-500',
    activeText: 'text-red-600 dark:text-red-400',
    activeDesc: 'text-red-700/70 dark:text-red-400/70',
    activeBadge: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  },
  {
    id: 'livre',
    label: 'Livre',
    icon: Shuffle,
    desc: 'Mostra somente a disciplina. O assunto fica livre na hora do estudo.',
    activeBorder: 'border-amber-400/50',
    activeBg: 'bg-amber-50/40 dark:bg-amber-950/10',
    activeBar: 'bg-amber-400',
    activeIcon: 'bg-amber-400',
    activeText: 'text-amber-600 dark:text-amber-400',
    activeDesc: 'text-amber-700/70 dark:text-amber-400/70',
    activeBadge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  },
];

const ModeSelector = ({ options, value, onChange }) => (
  <div className="grid grid-cols-2 gap-2 sm:gap-3">
    {options.map((opt) => {
      const active = value === opt.id;
      const Icon = opt.icon;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`relative flex min-h-[86px] flex-col items-start gap-2 overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-all duration-300 sm:min-h-[112px] sm:gap-2.5 sm:p-4 ${
            active
              ? `${opt.activeBorder} ${opt.activeBg} shadow-md sm:scale-[1.02]`
              : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80'
          }`}
        >
          <div className={`absolute inset-x-0 top-0 h-1 transition-all ${active ? opt.activeBar : 'bg-transparent'}`} />

          <div className="flex w-full items-center gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-sm transition-all sm:h-8 sm:w-8 ${active ? opt.activeIcon : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <Icon size={14} className={active ? 'text-white' : 'text-zinc-400'} />
            </div>
            <div className="min-w-0">
              <span className={`block text-[10px] font-black uppercase tracking-wider ${active ? opt.activeText : 'text-zinc-500 dark:text-zinc-400'}`}>
                {opt.label}
              </span>
              {active && (
                <div className={`mt-0.5 w-fit rounded-full px-1.5 py-0.5 text-[7px] font-black ${opt.activeBadge}`}>
                  ATIVO
                </div>
              )}
            </div>
          </div>

          <p className={`hidden text-[10px] font-medium leading-relaxed sm:block ${active ? opt.activeDesc : 'text-zinc-400 dark:text-zinc-500'}`}>
            {opt.desc}
          </p>
        </button>
      );
    })}
  </div>
);

export default function StepConfig({
  nomeCiclo,
  setNomeCiclo,
  tempoSessaoMinutos,
  setTempoSessaoMinutos,
  modoExibirAssuntos = true,
  setModoExibirAssuntos,
  coresDisciplinasAtivas = true,
  setCoresDisciplinasAtivas,
  disciplinasPreview = [],
  onDisciplinaCorChange,
  editalSelecionado,
  horasTotais = 0,
  totalDisciplinas = 0,
  minimumActiveDayMinutes = null,
  sessionAutoAdjustedNotice = null,
  totalSessionSlots = 0,
  minimumRequiredSessions = 0,
  distribuicaoCabeNaRotina = true,
}) {
  const modoAssuntos = modoExibirAssuntos === false ? 'livre' : 'guiado';
  const [colorDrafts, setColorDrafts] = useState({});
  const exemploDiaMinutos = minimumActiveDayMinutes || 120;
  const sessoesNoExemplo = Math.floor(exemploDiaMinutos / Math.max(1, tempoSessaoMinutos));
  const sobraNoExemplo = Math.max(0, exemploDiaMinutos - (sessoesNoExemplo * tempoSessaoMinutos));

  useEffect(() => {
    setColorDrafts((current) => {
      const next = {};
      let changed = false;
      disciplinasPreview.forEach((disciplina) => {
        const id = disciplina.id || disciplina.nome;
        next[id] = current[id] || disciplina.cor || '#71717a';
        if (next[id] !== current[id]) changed = true;
      });
      if (Object.keys(current).length !== Object.keys(next).length) changed = true;
      return changed ? next : current;
    });
  }, [disciplinasPreview]);

  const handleDraftColorChange = (disciplina, color) => {
    const id = disciplina.id || disciplina.nome;
    setColorDrafts((current) => ({ ...current, [id]: color }));
    onDisciplinaCorChange?.(disciplina.id, color);
  };

  const handleApplyColor = (disciplina) => {
    const id = disciplina.id || disciplina.nome;
    const color = colorDrafts[id] || disciplina.cor || '#71717a';
    onDisciplinaCorChange?.(disciplina.id, color);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 max-w-2xl mx-auto px-2 text-center shrink-0 sm:mb-8 sm:px-4"
      >
        <h2 className="mb-1 text-xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">
          Ajuste fino do seu<br /><span className="text-red-600">Plano</span>
        </h2>
        <p className="mx-auto hidden max-w-md text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 sm:block">
          Defina o nome e como o ciclo vai se comportar no seu dia a dia.
        </p>
      </motion.div>
      <div className="px-1 sm:px-4">
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full">
          <div className="flex-1 min-w-0">
            <div className="max-w-4xl mx-auto p-3 sm:p-7 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-3 sm:space-y-6">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Nome do Ciclo</label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={nomeCiclo}
                    onChange={(e) => setNomeCiclo(e.target.value)}
                    className="w-full p-3 text-sm text-left font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300 sm:p-4 sm:text-lg"
                    placeholder="Ex: CFO PMBA 2025"
                  />
                  <Edit2
                    size={16}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 opacity-70 pointer-events-none"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 dark:bg-zinc-800">
                    <BookOpen size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                      Foco do Conteudo
                    </h4>
                    <p className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Escolha como os blocos do ciclo aparecem no radar, na Home e no guia do dia.
                    </p>
                  </div>
                </div>
                <ModeSelector
                  options={OPCOES_ASSUNTOS}
                  value={modoAssuntos}
                  onChange={(id) => setModoExibirAssuntos?.(id !== 'livre')}
                />
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      <Palette size={19} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                        Cores por disciplina
                      </h4>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Use cores no radar ou deixe tudo neutro para uma leitura mais discreta.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={coresDisciplinasAtivas}
                    onClick={() => setCoresDisciplinasAtivas?.((current) => !current)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${coresDisciplinasAtivas ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${coresDisciplinasAtivas ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                {coresDisciplinasAtivas ? (
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2">
                    {disciplinasPreview.map((disciplina) => {
                      const draftId = disciplina.id || disciplina.nome;
                      const draftColor = colorDrafts[draftId] || disciplina.cor || '#71717a';
                      const isApplied = (disciplina.cor || '#71717a').toLowerCase() === draftColor.toLowerCase();

                      return (
                        <div
                          key={draftId}
                          className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-zinc-200 shadow-inner dark:border-zinc-700" style={{ backgroundColor: draftColor }}>
                            <input
                              type="color"
                              value={draftColor}
                              onChange={(event) => handleDraftColorChange(disciplina, event.target.value)}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              aria-label={`Cor de ${disciplina.nome}`}
                            />
                          </label>
                          <span className="min-w-0 flex-1 text-[11px] font-black uppercase leading-tight text-zinc-700 line-clamp-2 dark:text-zinc-200">
                            {disciplina.nome}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApplyColor(disciplina)}
                            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-[9px] font-black uppercase tracking-wider transition-all ${
                              isApplied
                                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:ring-emerald-900/40'
                                : 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700'
                            }`}
                          >
                            <Check size={12} />
                            {isApplied ? 'OK' : 'Aplicar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="h-8 w-8 rounded-xl bg-zinc-500 shadow-inner" />
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      O ciclo sera exibido em cinza, mas as cores escolhidas ficam guardadas para quando voce reativar.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50/70 to-white p-5 dark:border-red-950/50 dark:from-red-950/20 dark:to-zinc-900">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">Tempo de cada bloco de estudo</span>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Cada bloco aparece no radar com a mesma duracao; a dificuldade define quantos blocos cada materia recebe.
                    </p>
                  </div>
                </div>

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
                      {fmtMin(min)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Personalizar:</span>
                  <input
                    type="number"
                    min={10}
                    max={minimumActiveDayMinutes || 180}
                    value={tempoSessaoMinutos}
                    onChange={(e) => setTempoSessaoMinutos(Math.max(10, Math.min(minimumActiveDayMinutes || 180, Number(e.target.value))))}
                    className="w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm font-bold text-zinc-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-xs text-zinc-400">min por bloco</span>
                </div>

                <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-red-100 bg-white/80 p-3 dark:border-red-950/50 dark:bg-zinc-900/70">
                  <div className="rounded-xl bg-red-600 px-3 py-2 text-center text-white">
                    <p className="text-lg font-black leading-none">{fmtMin(tempoSessaoMinutos)}</p>
                    <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-red-100">1 bloco</p>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Em um dia de <strong>{fmtMin(exemploDiaMinutos)}</strong>, o sistema agenda <strong>{sessoesNoExemplo} {sessoesNoExemplo === 1 ? 'bloco' : 'blocos'}</strong>
                    {sobraNoExemplo > 0 ? ` e deixa ${fmtMin(sobraNoExemplo)} livres.` : '.'}
                  </p>
                </div>

                {minimumActiveDayMinutes && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Menor dia ativo configurado: <span className="font-black text-zinc-800 dark:text-white">{fmtMin(minimumActiveDayMinutes)}</span>. O bloco nao pode passar desse limite.
                  </p>
                )}

                {sessionAutoAdjustedNotice && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    A duracao do bloco foi ajustada automaticamente para {fmtMin(sessionAutoAdjustedNotice.adjustedTo)}, porque existe um dia ativo com apenas {fmtMin(sessionAutoAdjustedNotice.minDayMinutes)} disponiveis.
                  </div>
                )}
              </div>

              {!distribuicaoCabeNaRotina && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  Sua rotina comporta {totalSessionSlots} blocos, mas esta configuracao precisa de pelo menos {minimumRequiredSessions}. Aumente as horas, reduza o tempo do bloco ou remova a preferencia diaria no passo de disciplinas.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-4">
                  <div className="flex items-center gap-2 mb-2 text-zinc-400">
                    <Layers3 size={15} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Materias</span>
                  </div>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{totalDisciplinas}</p>
                  <p className="text-xs text-zinc-500 mt-1">Selecionadas para o ciclo</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-4">
                  <div className="flex items-center gap-2 mb-2 text-zinc-400">
                    <Clock size={15} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Carga</span>
                  </div>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{horasTotais}h</p>
                  <p className="text-xs text-zinc-500 mt-1">Disponibilidade semanal total</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                <Settings2 size={14} className="text-red-600" />
                Essas configuracoes podem ser ajustadas depois, sem perder o progresso do ciclo.
              </div>
            </div>
          </div>

          <div className="lg:w-[300px] shrink-0">
            <div className="sticky top-6 hidden lg:block">
              <EditalSidebarCard editalSelecionado={editalSelecionado} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
