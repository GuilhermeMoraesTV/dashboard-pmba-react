import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { FilePenLine, Loader2, Settings2, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="border-b border-zinc-100 bg-gradient-to-br from-emerald-600 to-zinc-950 p-5 text-white dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/65">Edicao simples</p>
              <h2 className="mt-1 text-xl font-black uppercase tracking-tight">Ajustes rapidos</h2>
              <p className="mt-2 max-w-xl text-sm font-medium text-white/75">
                Altere nome, inicio e exibicao sem mexer na distribuicao. Para mudar dias, horas ou disciplinas, use Recalcular planejamento.
              </p>
            </div>
            <button onClick={onFechar} className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Nome do planejamento</span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                placeholder="Ex: Cronograma PMBA"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Inicio do planejamento</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              />
            </label>
          </div>

          <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Rotina atual</p>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                {totalHorasSemanais}h/sem
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
              {DIAS.map((dia) => {
                const active = Number(horarios[dia.id] || 0) > 0;
                return (
                  <div key={dia.id} className={`rounded-2xl border p-2 text-center ${active ? 'border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-zinc-950' : 'border-zinc-200 bg-white/60 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50'}`}>
                    <p className={`rounded-xl py-2 text-xs font-black uppercase ${active ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-950'}`}>{dia.label}</p>
                    <p className="mt-2 text-xs font-black text-zinc-700 dark:text-zinc-200">{active ? `${horarios[dia.id]}h` : '-'}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Dias e horas redistribuem o cronograma. Use Recalcular planejamento para alterar essa estrutura.
            </p>
          </section>

          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Tempo de revisao</span>
              <input
                type="number"
                min="5"
                step="5"
                value={tempoRevisaoMinutos}
                onChange={(event) => setTempoRevisaoMinutos(Math.max(5, Number(event.target.value) || 20))}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Tempo nos cards</span>
              <select
                value={modoExibirTempo}
                onChange={(event) => setModoExibirTempo(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              >
                <option value="detalhado">Mostrar detalhado</option>
                <option value="simples">Mostrar simples</option>
              </select>
            </label>
          </section>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <p className="text-sm font-black text-zinc-900 dark:text-white">Guia por assunto</p>
              <p className="text-xs font-medium text-zinc-500">Mostra o assunto sugerido em cada bloco do cronograma.</p>
            </div>
            <input
              type="checkbox"
              checked={modoExibirAssuntos}
              onChange={(event) => setModoExibirAssuntos(event.target.checked)}
              className="h-5 w-5 accent-emerald-600"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-100 p-4 dark:border-zinc-800 sm:flex-row sm:justify-between">
          <button
            onClick={() => setModoCompleto(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Settings2 size={14} />
            Recalcular planejamento
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={onFechar} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Agora nao
            </button>
            <button
              onClick={handleSalvarRapido}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <FilePenLine size={14} />}
              Salvar ajustes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalEditarCronograma;
