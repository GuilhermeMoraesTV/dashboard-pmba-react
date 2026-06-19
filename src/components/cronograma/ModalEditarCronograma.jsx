import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  BookOpen, CalendarDays, Check, Clock3, FilePenLine,
  Loader2, Settings2, TimerReset, X,
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import WizardShell from './WizardShell';

const DIAS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sab' },
];

const normalizarHorarios = (cronograma) => {
  const source = cronograma?.horariosDetalhados || {};
  return DIAS.reduce((acc, dia) => {
    acc[dia.id] = Number(source[dia.id] ?? source[String(dia.id)] ?? 0);
    return acc;
  }, {});
};

const shiftDateByStartDelta = (value, oldStart, newStart) => {
  if (!value || !oldStart || !newStart || oldStart === newStart) return value || null;
  const oldDate = new Date(`${oldStart}T12:00:00`);
  const newDate = new Date(`${newStart}T12:00:00`);
  const endDate = new Date(`${value}T12:00:00`);
  if (Number.isNaN(oldDate.getTime()) || Number.isNaN(newDate.getTime()) || Number.isNaN(endDate.getTime())) return value;
  const deltaMs = newDate.getTime() - oldDate.getTime();
  const shifted = new Date(endDate.getTime() + deltaMs);
  return shifted.toISOString().slice(0, 10);
};

const ModalEditarCronograma = ({
  user,
  cronograma,
  onFechar,
  onCronogramaAtualizado,
  initialMode = 'simple',
}) => {
  const [modoCompleto, setModoCompleto] = useState(() => initialMode === 'recalculate');
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState(() => cronograma?.nome || '');
  const [dataInicio, setDataInicio] = useState(() => cronograma?.dataInicio || '');
  const [tempoRevisaoMinutos, setTempoRevisaoMinutos] = useState(() => Number(cronograma?.tempoRevisaoMinutos || 20));
  const [modoExibirAssuntos, setModoExibirAssuntos] = useState(() => cronograma?.modoExibirAssuntos !== false);
  const [modoExibirTempo, setModoExibirTempo] = useState(() => cronograma?.modoExibirTempo || 'detalhado');
  const horarios = normalizarHorarios(cronograma);

  if (!cronograma) return null;

  if (modoCompleto) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[50vh] animate-fade-in"
      >
        <WizardShell
          user={user}
          mode="edit"
          cronogramaId={cronograma.id}
          initialState={cronograma}
          initialStep={1}
          onClose={onFechar}
          onCronogramaCriado={(cronogramaId) => onCronogramaAtualizado?.(cronogramaId)}
        />
      </motion.div>
    );
  }

  const diasSelecionados = Object.values(horarios).filter((horas) => Number(horas) > 0).length;
  const totalHorasSemanais = Object.values(horarios).reduce((acc, horas) => acc + Number(horas || 0), 0);

  const handleSalvarRapido = async () => {
    if (!user?.uid || !cronograma?.id) return;
    setSalvando(true);
    try {
      const novoInicio = dataInicio || cronograma.dataInicio || null;
      const dataFimAjustada = typeof cronograma.dataFim === 'string'
        ? shiftDateByStartDelta(cronograma.dataFim, cronograma.dataInicio, novoInicio)
        : cronograma.dataFim || null;

      const updatePayload = {
        nome: nome.trim() || cronograma.nome || 'Meu cronograma',
        dataInicio: novoInicio,
        tempoRevisaoMinutos: Math.max(5, Number(tempoRevisaoMinutos) || 20),
        modoExibirAssuntos,
        modoExibirTempo,
      };
      if (dataFimAjustada) updatePayload.dataFim = dataFimAjustada;

      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronograma.id), updatePayload);
      onCronogramaAtualizado?.(cronograma.id);
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/80 px-4 py-3 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="relative overflow-hidden border-b border-red-700 bg-red-600 px-4 py-3 text-white">
          {cronograma.logoUrl && (
            <img
              src={cronograma.logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-4 h-36 w-36 rotate-[-12deg] object-contain opacity-20 saturate-0"
            />
          )}
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-100">Edicao simples</p>
              <h2 className="mt-0.5 text-lg font-black uppercase tracking-tight">Ajustes rapidos</h2>
              <p className="mt-1 text-xs font-medium text-red-50/90">Atualize nome, inicio e exibicao sem redistribuir os blocos.</p>
            </div>
            <button onClick={onFechar} className="shrink-0 rounded-lg p-2 text-white/80 transition hover:bg-red-700 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 overflow-y-auto bg-zinc-50/70 p-3 dark:bg-zinc-950">
          <div className="grid gap-2.5 md:grid-cols-2">
            <label className="block rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <Settings2 size={13} className="text-red-600" />
                Nome do planejamento
              </span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                placeholder="Ex: Cronograma PMBA"
              />
            </label>

            <label className="block rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <CalendarDays size={13} className="text-red-600" />
                Inicio do planejamento
              </span>
              <input
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </label>
          </div>

          <section className="rounded-2xl border border-red-100 bg-white p-2.5 shadow-sm dark:border-red-950/50 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
                  <CalendarDays size={13} />
                </span>
                Rotina atual
              </p>
              <span className="rounded-lg bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {totalHorasSemanais}h/sem
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS.map((dia) => {
                const active = Number(horarios[dia.id] || 0) > 0;
                return (
                  <div key={dia.id} className={`rounded-xl border p-1 text-center ${active ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20' : 'border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50'}`}>
                    <p className={`rounded-lg py-1 text-[9px] font-black uppercase ${active ? 'bg-red-600 text-white' : 'bg-white text-zinc-400 dark:bg-zinc-950'}`}>{dia.label}</p>
                    <p className="mt-1 text-[10px] font-black text-zinc-700 dark:text-zinc-200">{active ? `${horarios[dia.id]}h` : '-'}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] font-medium leading-snug text-red-700 dark:text-red-300">
              Para alterar dias, horas ou disciplinas, use Recalcular planejamento.
            </p>
          </section>

          <section className="grid gap-2.5 md:grid-cols-2">
            <label className="rounded-2xl border border-red-100 bg-white p-2.5 shadow-sm dark:border-red-950/50 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-600/20">
                  <TimerReset size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tempo de revisao</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={tempoRevisaoMinutos}
                      onChange={(event) => setTempoRevisaoMinutos(Math.max(5, Number(event.target.value) || 20))}
                      className="h-8 w-20 rounded-lg border-2 border-zinc-200 bg-zinc-50 px-2 text-center text-sm font-black text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    />
                    <span className="text-[10px] font-bold text-zinc-400">min por revisao</span>
                  </div>
                </div>
              </div>
            </label>

            <div className="rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-center gap-2">
                <Clock3 size={14} className="text-red-600" />
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Tempo nos cards</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['detalhado', 'Detalhado', 'Exibe a duracao completa.'],
                  ['simples', 'Simples', 'Mantem o card mais limpo.'],
                ].map(([value, title, description]) => {
                  const active = modoExibirTempo === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setModoExibirTempo(value)}
                      className={`flex min-w-0 items-start gap-2 rounded-xl border-2 p-2 text-left transition-all ${
                        active
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                          : 'border-zinc-200 bg-zinc-50 hover:border-red-300 dark:border-zinc-700 dark:bg-zinc-950'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {active && <Check size={9} strokeWidth={4} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[8px] font-black uppercase text-zinc-900 dark:text-white">{title}</span>
                        <span className="mt-0.5 block text-[8px] leading-snug text-zinc-500 dark:text-zinc-400">{description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-red-600" />
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Guia por assunto</p>
              </div>
              <p className="mt-1 text-[10px] font-medium text-zinc-500">Mostra o assunto sugerido em cada bloco do cronograma.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={modoExibirAssuntos}
              onClick={() => setModoExibirAssuntos((current) => !current)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${modoExibirAssuntos ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${modoExibirAssuntos ? 'right-1' : 'left-1'}`} />
            </button>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            onClick={() => setModoCompleto(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-600 transition hover:bg-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Settings2 size={13} />
            Recalcular planejamento
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onFechar} className="rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-500 transition hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900">
              Agora nao
            </button>
            <button
              onClick={handleSalvarRapido}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-[9px] font-black uppercase text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? <Loader2 size={13} className="animate-spin" /> : <FilePenLine size={13} />}
              Salvar ajustes
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default ModalEditarCronograma;
