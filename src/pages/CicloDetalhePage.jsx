import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';

import {
  ArrowLeft,
  Plus,
  RefreshCw
} from 'lucide-react';

const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek;
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

const dateToYMD = (date) => {
  return date.toISOString().split('T')[0];
};

// --- HELPER: Formatador Inteligente ---
const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';

  let totalMinutes = Math.round(Number(minutes));

  const remainder = totalMinutes % 60;
  if (remainder > 50) {
    totalMinutes = Math.ceil(totalMinutes / 60) * 60;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) {
      return `${mins}m`;
  } else if (mins === 0) {
      return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
};

function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, onStartStudy }) {

  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [viewModeCiclo, setViewModeCiclo] = useState('semanal');

  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);

  // --- Efeitos de Carregamento ---
  useEffect(() => {
     if (!user || !cicloId) return;
     setLoading(true);
     const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
     const unsubscribe = onSnapshot(cicloRef, (doc) => {
       if (doc.exists()) setCiclo({ id: doc.id, ...doc.data() });
       else setCiclo(null);
     }, (error) => { console.error(error); setLoading(false); });
     return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user || !cicloId) return;
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDisciplinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error(error));
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
     if (!user) return;
     const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
     const unsubscribe = onSnapshot(q, (snapshot) => {
        const todosRegistros = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || data.duracaoMinutos || 0),
                questoesFeitas: Number(data.questoesFeitas || 0),
                acertos: Number(data.acertos || data.questoesAcertadas || 0),
                data: typeof data.data === 'string' ? data.data : (data.data?.toDate ? dateToYMD_local(data.data.toDate()) : dateToYMD_local(new Date())),
                tipoEstudo: data.tipoEstudo || 'Teoria',
            };
        });
        setAllRegistrosEstudo(todosRegistros);
        setLoading(false);
     });
     return () => unsubscribe();
  }, [user]);

  const registrosDoCiclo = useMemo(() => {
      if (loading) return [];
      return allRegistrosEstudo.filter(reg => reg.cicloId === cicloId);
  }, [allRegistrosEstudo, cicloId, loading]);

  // Cálculo do progresso geral
  const { totalEstudado, totalMeta, progressoGeral } = useMemo(() => {
    if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0 };

    const startOfWeek = getStartOfWeek();
    const startOfWeekStr = dateToYMD(startOfWeek);

    const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0);
    const totalMetaCalc = Math.round(totalMetaRaw);

    let totalEstudadoCalc = 0;
    registrosDoCiclo.forEach(reg => {
      const minutos = Number(reg.tempoEstudadoMinutos);
      if (viewModeCiclo === 'semanal') {
        if (reg.data >= startOfWeekStr) {
          totalEstudadoCalc += minutos;
        }
      } else {
        totalEstudadoCalc += minutos;
      }
    });

    totalEstudadoCalc = Math.round(totalEstudadoCalc);
    const progresso = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0;

    return { totalEstudado: totalEstudadoCalc, totalMeta: totalMetaCalc, progressoGeral: progresso };
  }, [disciplinas, registrosDoCiclo, viewModeCiclo]);

  const handleViewDetails = (disciplina) => {
    setDisciplinaEmDetalhe(disciplina);
    setSelectedDisciplinaId(disciplina.id);
  };

  const handleStartStudy = (disciplina) => {
    if (ciclo?.ativo && onStartStudy) {
        onStartStudy(disciplina);
        setDisciplinaEmDetalhe(null);
        setSelectedDisciplinaId(null);
    }
  };

  const openRegistroModalWithTopic = (disciplinaId, topico) => {
    const disciplina = disciplinas.find(d => d.id === disciplinaId);
    if (disciplina) {
        setRegistroPreenchido({ disciplinaId: disciplina.id, topicoId: topico.id });
        setShowRegistroModal(true);
        setDisciplinaEmDetalhe(null);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div></div>;
  if (!ciclo) return <div className="p-10 text-center text-zinc-500">Ciclo não encontrado.</div>;

  return (
    <div className="relative flex flex-col h-full animate-fade-in">

      {/* --- CABEÇALHO TÁTICO COMPLETO --- */}
      <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <ArrowLeft size={16} /> Voltar
              </button>

              <button
                  onClick={() => setViewModeCiclo(prev => prev === 'semanal' ? 'total' : 'semanal')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-wide rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                  <RefreshCw size={16} />
                  {viewModeCiclo === 'semanal' ? 'Visão Semanal' : 'Visão Total'}
              </button>
          </div>

          {/* ALTERAÇÃO: Fundo alterado para bg-zinc-50 (cinza claro) e borda reforçada */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-2 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm">

              {/* Lado Esquerdo: Nome e Status */}
              <div className="flex-1">
                  <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                          {ciclo.nome}
                      </h1>
                      {ciclo.ativo ? (
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                      ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Arquivado</span>
                      )}
                  </div>
              </div>

              {/* Lado Direito: Estatísticas e Progresso */}
              <div className="flex items-center gap-6">
                  {/* Meta Semanal */}
                  <div className="text-center">
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Meta {viewModeCiclo === 'semanal' ? 'Semanal' : 'Total'}
                      </p>
                      <p className="text-2xl font-black text-zinc-800 dark:text-white font-mono">
                          {formatVisualNumber(totalMeta)}
                      </p>
                  </div>

                  {/* Divisor */}
                  <div className="w-px h-12 bg-zinc-200 dark:bg-zinc-700"></div>

                  {/* Realizado */}
                  <div className="text-center">
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Realizado
                      </p>
                      <p className="text-2xl font-black text-zinc-800 dark:text-white font-mono">
                          {formatVisualNumber(totalEstudado)}
                      </p>
                  </div>

                  {/* Divisor */}
                  <div className="w-px h-12 bg-zinc-200 dark:bg-zinc-700"></div>

                  {/* Círculo de Progresso */}
                  <div className="relative">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 80 80">
                          <circle
                              cx="40"
                              cy="40"
                              r="34"
                              fill="none"
                              stroke="currentColor"
                              className="text-zinc-200 dark:text-zinc-800"
                              strokeWidth="6"
                          />
                          <motion.circle
                              cx="40"
                              cy="40"
                              r="34"
                              fill="none"
                              stroke="currentColor"
                              className={progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 34}
                              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-black ${progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>
                              {progressoGeral.toFixed(0)}%
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Área Principal: Gráfico e Detalhes */}
      {/* ALTERAÇÃO: Aumentado para mt-20 (80px) para garantir o afastamento */}
      <div className="flex-grow mt-20">
          <CicloVisual
              selectedDisciplinaId={selectedDisciplinaId}
              onSelectDisciplina={setSelectedDisciplinaId}
              onViewDetails={handleViewDetails}
              onStartStudy={handleStartStudy}
              disciplinas={disciplinas}
              registrosEstudo={registrosDoCiclo}
              viewMode={viewModeCiclo}
              key={viewModeCiclo}
          />
      </div>

      {/* Botão Flutuante */}
      {ciclo.ativo && (
          <motion.button
              onClick={() => setShowRegistroModal(true)}
              className="fixed bottom-8 right-8 w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-2xl shadow-red-900/40 flex items-center justify-center z-50 transition-all hover:scale-110"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
          >
              <Plus size={28} strokeWidth={3} />
          </motion.button>
      )}

      {/* Modais */}
      <AnimatePresence>
        {disciplinaEmDetalhe && (
            <DisciplinaDetalheModal
                disciplina={disciplinaEmDetalhe}
                registrosEstudo={registrosDoCiclo}
                cicloId={cicloId}
                user={user.uid}
                onClose={() => { setDisciplinaEmDetalhe(null); setSelectedDisciplinaId(null); }}
                onQuickAddTopic={openRegistroModalWithTopic}
            />
        )}
        {showRegistroModal && (
            <RegistroEstudoModal
                onClose={() => setShowRegistroModal(false)}
                addRegistroEstudo={addRegistroEstudo}
                cicloId={cicloId}
                userId={user.uid}
                disciplinasDoCiclo={disciplinas}
                initialData={registroPreenchido}
            />
        )}
      </AnimatePresence>

      <div className="h-12"></div>
    </div>
  );
}

export default CicloDetalhePage;