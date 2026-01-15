import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';
import ModalConclusaoCiclo from '../components/ciclos/ModalConclusaoCiclo';
import { useCiclos } from '../hooks/useCiclos';

import {
  ArrowLeft,
  Plus,
  Trophy,
  Target,
  AlertTriangle,
  CalendarDays,
  Flag,
  BookOpen,
  ChevronRight
} from 'lucide-react';

// --- FUNÇÕES AUXILIARES ---
const dateToYMD_local = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSafeDate = (field) => {
    if (!field) return null;
    if (field.toDate && typeof field.toDate === 'function') {
        return field.toDate();
    }
    if (field instanceof Date) {
        return field;
    }
    const d = new Date(field);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
};

const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';
  let totalMinutes = Math.round(Number(minutes));
  const remainder = totalMinutes % 60;
  if (remainder > 50) {
    totalMinutes = Math.ceil(totalMinutes / 60) * 60;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  else if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// --- FUNÇÃO CORRIGIDA PARA IDENTIFICAR LOGOS ---
const getLogo = (ciclo) => {
    if(!ciclo) return null;
    // Se o objeto já tiver a URL salva (ideal), usa ela
    if(ciclo.logoUrl) return ciclo.logoUrl;

    // Fallback: Verifica pelo nome ou templateOrigem
    const searchString = (ciclo.templateOrigem || ciclo.nome || '').toLowerCase();

    if(searchString.includes('pmba')) return '/logosEditais/logo-pmba.png';
    if(searchString.includes('ppmg')) return '/logosEditais/logo-ppmg.png';
    if(searchString.includes('pcba')) return '/logosEditais/logo-pcba.png';
    if(searchString.includes('pmse')) return '/logosEditais/logo-pmse.png';

    // --- NOVOS EDITAIS ADICIONADOS AQUI ---
    if(searchString.includes('pmgo')) return '/logosEditais/logo-pmgo.png';
    if(searchString.includes('pmal')) return '/logosEditais/logo-pmal.png';
    if(searchString.includes('pmpe')) return '/logosEditais/logo-pmpe.png';
    if(searchString.includes('aquiraz') || searchString.includes('gcm')) return '/logosEditais/logo-aquiraz.png';

    return null;
};

function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, onStartStudy, onGoToEdital }) {

  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);

  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);

  const [showConclusaoModal, setShowConclusaoModal] = useState(false);

  const { concluirCicloSemanal, loading: cicloActionLoading, error: cicloActionError } = useCiclos(user);

  const [cicloLoaded, setCicloLoaded] = useState(false);
  const [disciplinasLoaded, setDisciplinasLoaded] = useState(false);
  const [registrosLoaded, setRegistrosLoaded] = useState(false);

  // --- EFEITOS ---
  useEffect(() => {
     if (!user || !cicloId) return;
     const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
     const unsubscribe = onSnapshot(cicloRef, (doc) => {
       if (doc.exists()) {
           const data = doc.data();
           const rawDate = getSafeDate(data.ultimaConclusao) || getSafeDate(data.dataCriacao) || new Date();

           setCiclo({
               id: doc.id,
               ...data,
               cargaHorariaSemanalTotal: Number(data.cargaHorariaSemanalTotal || 0),
               conclusoes: Number(data.conclusoes || 0),
               dataInicioAtual: rawDate
           });
           setCicloLoaded(true);
       } else {
           setCiclo(null);
           setCicloLoaded(true);
       }
     }, (error) => { console.error(error); setCicloLoaded(true); });
     return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user || !cicloId) return;
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDisciplinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDisciplinasLoaded(true);
    }, (error) => { console.error(error); setDisciplinasLoaded(true); });
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
     if (!user) return;
     const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
     const unsubscribe = onSnapshot(q, (snapshot) => {
        const todosRegistros = snapshot.docs.map(doc => {
            const data = doc.data();
            const rawRegDate = getSafeDate(data.data);
            const rawTimestamp = getSafeDate(data.timestamp);

            return {
                id: doc.id,
                ...data,
                tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || data.duracaoMinutos || 0),
                questoesFeitas: Number(data.questoesFeitas || 0),
                acertos: Number(data.acertos || data.questoesAcertadas || 0),
                data: rawRegDate ? dateToYMD_local(rawRegDate) : (data.data || dateToYMD_local(new Date())),
                tipoEstudo: data.tipoEstudo || 'Teoria',
                timestamp: rawTimestamp || new Date(0),
                conclusaoId: data.conclusaoId || null,
            };
        });
        setAllRegistrosEstudo(todosRegistros);
        setRegistrosLoaded(true);
     }, (error) => { console.error(error); setRegistrosLoaded(true); });
     return () => unsubscribe();
  }, [user]);

  useEffect(() => {
      if (cicloLoaded && disciplinasLoaded && registrosLoaded) {
          setLoading(false);
      }
  }, [cicloLoaded, disciplinasLoaded, registrosLoaded]);

  // --- LÓGICA DE FILTROS ---
  const registrosAtivosDoCiclo = useMemo(() => {
      if (!allRegistrosEstudo.length) return [];
      return allRegistrosEstudo.filter(reg => reg.cicloId === cicloId && !reg.conclusaoId);
  }, [allRegistrosEstudo, cicloId]);

  const registrosDoPeriodo = useMemo(() => {
      return registrosAtivosDoCiclo;
  }, [registrosAtivosDoCiclo]);


  // Cálculo do progresso
  const { totalEstudado, totalMeta, progressoGeral, registrosPorDisciplina } = useMemo(() => {
    if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0, registrosPorDisciplina: {} };

    const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0);
    const totalMetaCalc = Math.round(totalMetaRaw);

    const registrosPorDisciplina = {};
    let totalEstudadoCalc = 0;

    registrosDoPeriodo.forEach(reg => {
        const minutos = Number(reg.tempoEstudadoMinutos);
        totalEstudadoCalc += minutos;

        const discId = reg.disciplinaId;
        if (discId) {
            registrosPorDisciplina[discId] = (registrosPorDisciplina[discId] || 0) + minutos;
        }
    });

    totalEstudadoCalc = Math.round(totalEstudadoCalc);
    const progresso = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0;

    return { totalEstudado: totalEstudadoCalc, totalMeta: totalMetaCalc, progressoGeral: progresso, registrosPorDisciplina };
  }, [disciplinas, registrosDoPeriodo]);


  // Verificação de Metas
  const isAllDisciplinesMet = useMemo(() => {
      if (!ciclo?.ativo) return false;
      if (disciplinas.length === 0) return false;
      if (totalMeta === 0) return false;

      const allMet = disciplinas.every(disciplina => {
          const metaMinutos = Number(disciplina.tempoAlocadoSemanalMinutos || 0);
          const estudadoMinutos = registrosPorDisciplina[disciplina.id] || 0;

          if (metaMinutos > 0) {
              return estudadoMinutos >= metaMinutos;
          }
          return true;
      });

      return allMet;
  }, [disciplinas, registrosPorDisciplina, ciclo?.ativo, totalMeta]);

  const canConcludeCiclo = ciclo?.ativo && progressoGeral >= 100 && isAllDisciplinesMet;


  const handleConcluirCiclo = async () => {
    if (!canConcludeCiclo) {
         alert("Não é possível concluir. As metas individuais de todas as disciplinas não foram atingidas.");
         return;
    }
    if (cicloActionLoading) return;

    setShowConclusaoModal(false);
    const sucesso = await concluirCicloSemanal(cicloId);

    if (sucesso) {
        onBack();
    } else if (cicloActionError) {
        alert(`Erro ao concluir: ${cicloActionError}`);
    }
  };


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

  const showEmptyMessage = !disciplinas.length;
  const logo = getLogo(ciclo);

  // --- CÁLCULO DAS DATAS (INÍCIO E META) ---
  let formattedStartDate = '...';
  let formattedEndDate = '...';

  if (ciclo.dataInicioAtual) {
      const startDay = ciclo.dataInicioAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const startWeekDay = ciclo.dataInicioAtual.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      formattedStartDate = `${startWeekDay}, ${startDay}`;

      const endDate = new Date(ciclo.dataInicioAtual);
      endDate.setDate(endDate.getDate() + 7);

      const endDay = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const endWeekDay = endDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      formattedEndDate = `${endWeekDay}, ${endDay}`;
  }


  return (
    <div className="relative flex flex-col h-full animate-fade-in">

      <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <ArrowLeft size={16} /> Voltar
              </button>

              <div className="flex items-center gap-3">
                  {ciclo.ativo && canConcludeCiclo && (
                      <button
                          onClick={() => setShowConclusaoModal(true)}
                          disabled={cicloActionLoading}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide rounded-xl shadow-md hover:bg-emerald-700 transition-colors animate-pulse"
                      >
                          <Trophy size={16} /> Concluir Missão ({ciclo.conclusoes}x)
                      </button>
                  )}

                  {ciclo.ativo && progressoGeral >= 100 && !isAllDisciplinesMet && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md border border-red-300 dark:border-red-700">
                         <AlertTriangle size={16} /> Complete todas as matérias!
                     </div>
                  )}
              </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">

              {/* --- LOGO DO EDITAL (MARCA D'ÁGUA AJUSTADA) --- */}
              {logo && (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-20 md:opacity-10 dark:opacity-30 dark:md:opacity-20 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500">
                      <img src={logo} alt="Logo Edital" className="w-full h-full object-contain" />
                  </div>
              )}

              <div className="flex-1 z-10">
                  <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
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

                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                                <CalendarDays size={13} />
                                <p className="text-[10px] font-bold uppercase tracking-wide">
                                    Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-1.5 text-zinc-400">
                                <Flag size={13} />
                                <p className="text-[10px] font-bold uppercase tracking-wide">
                                    Meta: <span className="text-zinc-600 dark:text-zinc-300">{formattedEndDate}</span>
                                </p>
                            </div>
                        </div>

                        {/* BOTÃO DE EDITAL */}
                        <button
                            onClick={onGoToEdital}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                       bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200
                                       dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30
                                       text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400
                                       text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20"
                        >
                            <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                            <span>Acessar Edital</span>
                            <ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>

                  </div>
              </div>

              <div className="flex items-center gap-6 z-10">
                  <div className="text-center hidden sm:block">
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Meta
                      </p>
                      <p className="text-xl font-black text-zinc-800 dark:text-white font-mono">
                          {formatVisualNumber(totalMeta)}
                      </p>
                  </div>

                  <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>

                  <div className="text-center hidden sm:block">
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Feito
                      </p>
                      <p className="text-xl font-black text-zinc-800 dark:text-white font-mono">
                          {formatVisualNumber(totalEstudado)}
                      </p>
                  </div>

                  <div className="relative">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
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
                              className={progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 34}
                              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-xl font-black ${progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>
                              {progressoGeral.toFixed(0)}%
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {showEmptyMessage ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mt-8">
            <Target size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Ciclo Sem Disciplinas</h3>
            <p className="text-zinc-500 text-sm mb-6">Parece que este ciclo ainda não tem disciplinas configuradas. Edite o ciclo para adicionar suas matérias!</p>
        </div>
      ) : (
          <div className="flex-grow mt-20">
              <CicloVisual
                  selectedDisciplinaId={selectedDisciplinaId}
                  onSelectDisciplina={setSelectedDisciplinaId}
                  onViewDetails={handleViewDetails}
                  onStartStudy={handleStartStudy}
                  disciplinas={disciplinas.map(d => ({
                      ...d,
                      progressoEstudadoMinutos: registrosPorDisciplina[d.id] || 0
                  }))}
                  registrosEstudo={registrosDoPeriodo}
                  viewMode={'total'}
                  ciclo={ciclo}
              />
          </div>
      )}

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

      <AnimatePresence>
        {showConclusaoModal && (
            <ModalConclusaoCiclo
                ciclo={ciclo}
                onClose={() => setShowConclusaoModal(false)}
                onConfirm={handleConcluirCiclo}
                loading={cicloActionLoading}
                progressoGeral={progressoGeral}
            />
        )}
        {disciplinaEmDetalhe && (
            <DisciplinaDetalheModal
                disciplina={disciplinaEmDetalhe}
                registrosEstudo={registrosDoPeriodo}
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