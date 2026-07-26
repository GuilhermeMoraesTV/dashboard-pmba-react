import React from 'react';
import { motion } from 'framer-motion';
import { Brain, CheckCircle2, Clock, BookOpen, Zap, Timer } from 'lucide-react';

// ─── INTERVALOS DA REVISÃO ESPAÇADA ──────────────────────────────────────────
const INTERVALOS = [
  {
    label:  '1ª revisão',
    quando: '1 dia após',
    icon:   '🌅',
    cor:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    borda:  'border-emerald-200 dark:border-emerald-800',
    desc:   'Reforça antes do esquecimento inicial',
  },
  {
    label:  '2ª revisão',
    quando: '7 dias após',
    icon:   '📅',
    cor:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    borda:  'border-blue-200 dark:border-blue-800',
    desc:   'Consolida na memória de médio prazo',
  },
  {
    label:  '3ª revisão',
    quando: '30 dias após',
    icon:   '🏆',
    cor:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    borda:  'border-red-200 dark:border-red-800',
    desc:   'Transfere para memória de longo prazo',
  },
];

const OPCOES_TEMPO = [10, 15, 20, 30];

const BENEFICIOS = [];


// ─── COMPONENTE DE SPLIT VISUAL (75% estudo / 25% revisão) ───────────────────
const SplitVisual = () => (
  <div className="w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
    <div className="flex h-3">
      <div className="bg-red-500 dark:bg-red-600" style={{ width: '75%' }} />
      <div className="bg-zinc-300 dark:bg-zinc-600" style={{ width: '25%' }} />
    </div>
    <div className="grid grid-cols-2 divide-x divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
      <div className="min-w-0 px-2.5 py-3 sm:px-4 flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          <BookOpen size={14} className="text-red-600 dark:text-red-400" />
        </div>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white whitespace-nowrap">75% Estudo</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Conteúdo novo</div>
        </div>
      </div>
      <div className="min-w-0 flex items-center gap-2 sm:gap-3 px-2.5 py-3 sm:px-4">
        <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          <Zap size={14} className="text-zinc-500 dark:text-zinc-400" />
        </div>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white whitespace-nowrap">25% Revisão</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Fixação</div>
        </div>
      </div>
    </div>
  </div>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const StepMetodologiaRevisao = ({ config = {}, onConfigChange = () => {} }) => {
  // Valor atual com fallback para 20 min (garante botão correto ao restaurar draft)
  const tempoSelecionado = config.tempoRevisaoMinutos ?? 20;

  return (
    <div className="flex flex-col items-center min-h-full py-2 max-w-2xl mx-auto px-2 sm:px-4 sm:py-4">

      {/* Cabeçalho Padronizado */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3 w-full mx-auto px-2 sm:mb-8 sm:px-4"
      >
        <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-red-600/30 sm:mb-5 sm:h-14 sm:w-14 sm:rounded-2xl">
          <Brain size={26} className="text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-1 sm:mb-3">
          Revisão <span className="text-red-600">Espaçada</span>
        </h2>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-md mx-auto sm:text-sm">
          Seu cronograma reserva automaticamente 25% do seu tempo diário para
          revisões — nos momentos exatos em que o esquecimento começa.
        </p>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400 sm:mt-3 sm:text-[11px] sm:tracking-[0.16em]">
          Este passo nao escolhe modo de revisao. Ele apenas define o tempo de cada revisao.
        </p>
      </motion.div>

      {/* Split visual 75% / 25% */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="w-full mb-2 sm:mb-4"
      >
        <SplitVisual />
        <p className="text-[10px] text-zinc-400 text-center mt-2 leading-relaxed sm:mt-3 sm:text-[11px]">
          O tempo de revisão é fluido — se não houver revisões pendentes num dia,
          aquele tempo é automaticamente devolvido ao estudo.
        </p>
      </motion.div>

      {/* Cards dos intervalos — 3 colunas */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="hidden"
      >
        {INTERVALOS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12 + i * 0.06 }}
            className={`rounded-2xl border p-4 ${item.borda} bg-white dark:bg-zinc-900`}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.cor}`}>
                {item.label}
              </span>
            </div>
            <div className="text-base font-black text-zinc-900 dark:text-white mb-1">
              {item.quando}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Linha de fluxo visual — 1d · 7d · 30d */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32 }}
        className="hidden"
      >
        <span className="text-zinc-600 dark:text-zinc-300">Estudo</span>
        <div className="flex-1 max-w-[260px] flex items-center gap-0.5">
          {['1d', '7d', '30d'].map((d) => (
            <React.Fragment key={d}>
              <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-700" />
              <div className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-[9px] font-black shrink-0">
                {d}
              </div>
            </React.Fragment>
          ))}
          <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <span className="text-zinc-600 dark:text-zinc-300">Fixado ✓</span>
      </motion.div>

      {/* Benefícios */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="hidden"
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-zinc-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Por que funciona</span>
        </div>
        <ul className="space-y-2">
          {BENEFICIOS.map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px] text-zinc-600 dark:text-zinc-400">
              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* ── Seção de Configuração: Tempo por Revisão ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-3 mb-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Timer size={14} className="text-red-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Tempo por revisão
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3 sm:mb-4 sm:text-[12px]">
          Escolha quanto tempo cada revisao deve ocupar quando ela existir no dia.
        </p>

        <div className="mb-3 hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700 px-4 py-3 sm:block">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              O sistema agenda revisoes apos o estudo e usa esse tempo apenas quando houver revisao pendente.
            </p>
            <div className="flex gap-1.5 shrink-0">
              {['1d', '7d', '30d'].map((intervalo) => (
                <span
                  key={intervalo}
                  className="px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-[10px] font-black"
                >
                  {intervalo}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2">
          {OPCOES_TEMPO.map((min) => {
            const ativo = tempoSelecionado === min;
            return (
              <button
                key={min}
                type="button"
                onClick={() =>
                  onConfigChange((prev) => ({ ...prev, tempoRevisaoMinutos: min }))
                }
                className={`
                  flex-1 py-2 rounded-xl text-xs font-black transition-all duration-150 sm:py-2.5 sm:text-sm
                  border focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50
                  ${ativo
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                {min} min
              </button>
            );
          })}
        </div>

        <p className="hidden text-[10px] text-zinc-400 dark:text-zinc-500 mt-3 leading-relaxed sm:block">
          Padrão: 20 minutos por revisão.
        </p>
      </motion.div>


    </div>
  );
};

export default StepMetodologiaRevisao;
