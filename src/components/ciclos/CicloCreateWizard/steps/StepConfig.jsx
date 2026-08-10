import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, EyeOff, Hash, LayoutList, Palette, Settings2, Shuffle, Target, Timer } from 'lucide-react';
import ColorisSwatch from '../../../shared/ColorisSwatch';

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

const OPCOES_TEMPO = [
  {
    id: 'detalhado',
    label: 'Detalhado',
    icon: Timer,
    desc: 'Mostra o tempo de cada bloco no guia para acompanhar exatamente quanto estudar.',
    activeBorder: 'border-blue-500/50',
    activeBg: 'bg-blue-50/40 dark:bg-blue-950/10',
    activeBar: 'bg-blue-500',
    activeIcon: 'bg-blue-500',
    activeText: 'text-blue-600 dark:text-blue-400',
    activeDesc: 'text-blue-700/70 dark:text-blue-400/70',
    activeBadge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'total',
    label: 'So Total',
    icon: Clock,
    desc: 'Mostra apenas o total previsto no dia, deixando os cards do guia mais limpos.',
    activeBorder: 'border-violet-500/50',
    activeBg: 'bg-violet-50/40 dark:bg-violet-950/10',
    activeBar: 'bg-violet-500',
    activeIcon: 'bg-violet-500',
    activeText: 'text-violet-600 dark:text-violet-400',
    activeDesc: 'text-violet-700/70 dark:text-violet-400/70',
    activeBadge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
  },
  {
    id: 'nenhum',
    label: 'Ocultar',
    icon: EyeOff,
    desc: 'Esconde horarios e duracoes para focar somente no conteudo do ciclo.',
    activeBorder: 'border-zinc-400/50',
    activeBg: 'bg-zinc-50/50 dark:bg-zinc-800/50',
    activeBar: 'bg-zinc-400',
    activeIcon: 'bg-zinc-400',
    activeText: 'text-zinc-600 dark:text-zinc-300',
    activeDesc: 'text-zinc-500/70',
    activeBadge: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
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

          <p className={`text-[9px] font-medium leading-snug sm:text-[10px] sm:leading-relaxed ${active ? opt.activeDesc : 'text-zinc-400 dark:text-zinc-500'}`}>
            {opt.desc}
          </p>
        </button>
      );
    })}
  </div>
);

const EditalMiniCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-center relative overflow-hidden h-full min-h-[120px]">
    <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" />
    <div className="w-16 h-16 shrink-0 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-1 mb-2 z-10">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo" className="w-full h-full object-contain" />
      ) : <Target size={20} className="text-red-500" />}
    </div>
    <h3 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase line-clamp-2 leading-tight">
      {editalSelecionado?.titulo || editalSelecionado?.nome || 'Ciclo Manual'}
    </h3>
  </div>
);

const PageHeader = () => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center mb-3 max-w-2xl mx-auto px-2 shrink-0 sm:mb-8 sm:px-4"
  >
    <h2 className="text-4xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-2 sm:mb-3">
      Ajuste fino do seu<br /><span className="text-red-600">Plano</span>
    </h2>
    <p className="block text-zinc-500 dark:text-zinc-400 text-base sm:text-sm font-semibold leading-relaxed max-w-md mx-auto">
      Defina o nome e como o ciclo vai se comportar no seu dia a dia.
    </p>
  </motion.div>
);

export default function StepConfig({
  nomeCiclo,
  setNomeCiclo,
  coresDisciplinasAtivas = true,
  setCoresDisciplinasAtivas,
  disciplinasPreview = [],
  onDisciplinaCorChange,
  editalSelecionado,
}) {
  const [colorDrafts, setColorDrafts] = useState({});

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
    if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) {
      const id = disciplina.id || disciplina.nome;
      setColorDrafts((current) => ({ ...current, [id]: color }));
      return;
    }
    const id = disciplina.id || disciplina.nome;
    setColorDrafts((current) => ({ ...current, [id]: color }));
    onDisciplinaCorChange?.(disciplina.id, color);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <PageHeader />

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-8 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pb-10 px-2 sm:px-0">
          <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-6">
            <div className={editalSelecionado ? 'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 lg:block' : ''}>
              {editalSelecionado && (
                <div className="lg:hidden">
                  <EditalMiniCard editalSelecionado={editalSelecionado} />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="group bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-focus-within:text-red-500 transition-colors">
                    <Hash size={16} />
                  </div>
                  <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.15em] text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors">
                    Nome do Ciclo
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={nomeCiclo}
                    onChange={(e) => setNomeCiclo(e.target.value)}
                    className="w-full px-3 py-3 sm:px-5 sm:py-4 text-sm sm:text-lg font-black bg-zinc-50 dark:bg-zinc-950 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-red-500/20 focus:ring-4 focus:ring-red-500/5 rounded-xl sm:rounded-2xl outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                    placeholder="Ex: CFO PMBA 2025"
                  />
                </div>
                <div className="mt-3 hidden sm:flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                  <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span>Use um nome que identifique claramente seu objetivo</span>
                </div>
              </motion.div>
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
                  <div className="grid max-h-[22rem] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar md:max-h-56 md:grid-cols-2">
                    {disciplinasPreview.map((disciplina) => {
                      const draftId = disciplina.id || disciplina.nome;
                      const draftColor = colorDrafts[draftId] || disciplina.cor || '#71717a';

                      return (
                        <div
                          key={draftId}
                          className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="min-w-0 flex-1 text-[11px] font-black uppercase leading-tight text-zinc-700 line-clamp-2 dark:text-zinc-200">
                              {disciplina.nome}
                            </span>
                            <ColorisSwatch
                              value={draftColor}
                              onChange={(color) => handleDraftColorChange(disciplina, color)}
                              label={`Escolher cor de ${disciplina.nome}`}
                              sizeClass="h-9 w-9 sm:h-10 sm:w-10"
                            />
                          </div>
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


              <div className="flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                <Settings2 size={14} className="text-red-600" />
                Essas configuracoes podem ser ajustadas depois, sem perder o progresso do ciclo.
              </div>
            </div>

          <div className="lg:w-[300px] shrink-0">
            <div className="sticky top-6 hidden lg:block">
              <EditalSidebarCard editalSelecionado={editalSelecionado} />
            </div>
          </div>
        </div>
    </div>
  );
}
