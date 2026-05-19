import React from 'react';
import { BookOpen, Clock, Edit2, Layers3, LayoutList, Settings2, Shuffle, Target } from 'lucide-react';

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
    <div className="relative z-10 w-24 h-24 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-3 mb-4 shadow-lg shadow-red-500/20">
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
    desc: 'Mostra a disciplina e o assunto sugerido em cada sessao.',
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
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {options.map((opt) => {
      const active = value === opt.id;
      const Icon = opt.icon;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`relative flex min-h-[112px] flex-col items-start gap-2.5 overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
            active
              ? `${opt.activeBorder} ${opt.activeBg} shadow-md sm:scale-[1.02]`
              : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80'
          }`}
        >
          <div className={`absolute inset-x-0 top-0 h-1 transition-all ${active ? opt.activeBar : 'bg-transparent'}`} />

          <div className="flex w-full items-center gap-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm transition-all ${active ? opt.activeIcon : 'bg-zinc-100 dark:bg-zinc-800'}`}>
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

          <p className={`text-[10px] font-medium leading-relaxed ${active ? opt.activeDesc : 'text-zinc-400 dark:text-zinc-500'}`}>
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
  editalSelecionado,
  horasTotais = 0,
  totalDisciplinas = 0,
  minimumActiveDayMinutes = null,
  sessionAutoAdjustedNotice = null,
}) {
  const modoAssuntos = modoExibirAssuntos === false ? 'livre' : 'guiado';

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <div className="px-1 sm:px-4">
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full">
          <div className="flex-1 min-w-0">
            <div className="max-w-4xl mx-auto p-5 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-6">
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Configuracoes do Ciclo</h3>
                <p className="text-sm text-zinc-500 mt-2">Defina o nome do ciclo e ajuste a duracao das sessoes.</p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Nome do Ciclo</label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={nomeCiclo}
                    onChange={(e) => setNomeCiclo(e.target.value)}
                    className="w-full p-4 text-lg text-left font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300"
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
                      Escolha como as sessoes do ciclo aparecem no radar, na Home e no guia do dia.
                    </p>
                  </div>
                </div>
                <ModeSelector
                  options={OPCOES_ASSUNTOS}
                  value={modoAssuntos}
                  onChange={(id) => setModoExibirAssuntos?.(id !== 'livre')}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-zinc-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Duracao de cada sessao</span>
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
                  <span className="text-xs text-zinc-500">Ou defina:</span>
                  <input
                    type="number"
                    min={10}
                    max={minimumActiveDayMinutes || 180}
                    value={tempoSessaoMinutos}
                    onChange={(e) => setTempoSessaoMinutos(Math.max(10, Math.min(minimumActiveDayMinutes || 180, Number(e.target.value))))}
                    className="w-20 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm font-bold text-zinc-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-xs text-zinc-400">por sessao</span>
                </div>

                {minimumActiveDayMinutes && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Menor dia ativo configurado: <span className="font-black text-zinc-800 dark:text-white">{fmtMin(minimumActiveDayMinutes)}</span>. A sessao nao pode passar desse limite.
                  </p>
                )}

                {sessionAutoAdjustedNotice && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    A duracao da sessao foi ajustada automaticamente para {fmtMin(sessionAutoAdjustedNotice.adjustedTo)}, porque existe um dia ativo com apenas {fmtMin(sessionAutoAdjustedNotice.minDayMinutes)} disponiveis.
                  </div>
                )}
              </div>

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
