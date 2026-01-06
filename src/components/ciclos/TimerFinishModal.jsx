import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Target, Save, Clock, Plus, Minus,
  BookOpen, List, FileText, AlertTriangle, CheckSquare,
  RotateCcw, Trash2
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

// --- Modal de Confirmação de Descarte (Igual ao do Timer) ---
const DiscardConfirmationModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <motion.div
            className="fixed inset-0 z-[10001] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="bg-zinc-900 border border-red-500/30 shadow-2xl rounded-xl p-6 w-full max-w-sm">
                <div className="flex items-start gap-4">
                    <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Descartar Sessão?</h3>
                        <p className="text-sm text-zinc-400">Todo o progresso deste estudo será perdido permanentemente.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700">Cancelar</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Sim, Descartar</button>
                </div>
            </div>
        </motion.div>
    );
};

function TimerFinishModal({
  timeMinutes,
  disciplinaNome,
  activeCicloId,
  userUid,
  onConfirm,
  onCancel, // Botão Retomar (usado apenas no footer agora)
  onDiscard, // Botão Descartar
  initialAssunto
}) {
  const [step, setStep] = useState(1);
  const [hasQuestions, setHasQuestions] = useState(null);
  const [questionsData, setQuestionsData] = useState({ total: 0, correct: 0 });
  const [assuntoSelecionado, setAssuntoSelecionado] = useState('');
  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);
  const [obs, setObs] = useState('');
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [markAsFinished, setMarkAsFinished] = useState(false);
  const [disciplinaManual, setDisciplinaManual] = useState('');
  const [todasDisciplinas, setTodasDisciplinas] = useState([]);
  const [erroDisciplina, setErroDisciplina] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estado para o modal de confirmação de descarte
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

  useEffect(() => {
    if (initialAssunto) {
        setAssuntoSelecionado(initialAssunto);
    }
  }, [initialAssunto]);

  useEffect(() => {
    const fetchAssuntos = async () => {
        if(!activeCicloId || !userUid) return;
        setLoadingAssuntos(true);
        try {
            const cicloDocRef = doc(db, 'users', userUid, 'ciclos', activeCicloId);
            const cicloDoc = await getDoc(cicloDocRef);
            let listaDisciplinas = [];
            if(cicloDoc.exists()){
                const data = cicloDoc.data();
                if (data.disciplinas && Array.isArray(data.disciplinas)) listaDisciplinas = data.disciplinas;
            }
            if (listaDisciplinas.length === 0) {
                const subColRef = collection(db, 'users', userUid, 'ciclos', activeCicloId, 'disciplinas');
                const subSnap = await getDocs(subColRef);
                listaDisciplinas = subSnap.docs.map(d => d.data());
            }
            setTodasDisciplinas(listaDisciplinas);
            let disciplinaAlvo = listaDisciplinas.find(d => normalize(d.nome) === normalize(disciplinaNome));
            if (!disciplinaAlvo) disciplinaAlvo = listaDisciplinas.find(d => normalize(d.nome).includes(normalize(disciplinaNome)) || normalize(disciplinaNome).includes(normalize(d.nome)));
            if(disciplinaAlvo){
                setDisciplinaManual(disciplinaAlvo.nome);
                if(Array.isArray(disciplinaAlvo.assuntos)) {
                    setAssuntosDisponiveis(disciplinaAlvo.assuntos);
                    if (initialAssunto) setAssuntoSelecionado(initialAssunto);
                }
                else setAssuntosDisponiveis([]);
            } else {
                setErroDisciplina(true);
            }
        } catch (error) { console.error("Erro:", error); }
        finally { setLoadingAssuntos(false); }
    };
    fetchAssuntos();
  }, [activeCicloId, userUid, disciplinaNome, initialAssunto]);

  const handleManualDisciplinaChange = (novaDisciplinaNome) => {
      setDisciplinaManual(novaDisciplinaNome);
      const disc = todasDisciplinas.find(d => d.nome === novaDisciplinaNome);
      if (disc && Array.isArray(disc.assuntos)) {
          setAssuntosDisponiveis(disc.assuntos);
          setErroDisciplina(false);
          setAssuntoSelecionado('');
      } else {
          setAssuntosDisponiveis([]);
      }
  };

  const formatTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleNext = (didQuestions) => {
    setHasQuestions(didQuestions);
    setStep(2);
  };

  const handleValueChange = (field, amount) => {
    setQuestionsData(prev => {
      const newValue = Math.max(0, Number(prev[field]) + amount);
      if (field === 'total') return { ...prev, total: newValue, correct: Math.min(prev.correct, newValue) };
      if (field === 'correct') return { ...prev, correct: Math.min(newValue, prev.total) };
      return prev;
    });
  };

  const handleInputChange = (field, value) => {
      const numValue = parseInt(value) || 0;
      setQuestionsData(prev => {
          if (field === 'total') return { ...prev, total: numValue, correct: Math.min(prev.correct, numValue) };
          if (field === 'correct') return { ...prev, correct: Math.min(numValue, prev.total) };
          return prev;
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!assuntoSelecionado) {
        setErrorMessage("Por favor, selecione o assunto/tópico estudado.");
        return;
    }

    onConfirm({
      questions: hasQuestions ? (parseInt(questionsData.total) || 0) : 0,
      correct: hasQuestions ? (parseInt(questionsData.correct) || 0) : 0,
      obs: obs,
      assunto: assuntoSelecionado,
      disciplinaNomeCorrigido: disciplinaManual !== disciplinaNome ? disciplinaManual : null,
      markAsFinished: markAsFinished
    });
  };

  const NumberInputControl = ({ label, value, onChange, onIncrement, onDecrement, icon: Icon, colorClass }) => (
    <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
            <button type="button" onClick={onDecrement} className="p-3 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-95"><Minus size={18} /></button>
            <div className="flex-1 relative">
                <Icon className={`absolute left-0 top-1/2 -translate-y-1/2 ${colorClass}`} size={18} />
                <input type="number" min="0" value={value === 0 ? '' : value} onChange={(e) => onChange(e.target.value)} placeholder="0" className="w-full bg-transparent text-center font-black text-xl text-zinc-800 dark:text-white outline-none p-1 pl-6" />
            </div>
            <button type="button" onClick={onIncrement} className="p-3 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-95"><Plus size={18} /></button>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">

      {/* Modal de confirmação de descarte */}
      <AnimatePresence>
        <DiscardConfirmationModal
            isOpen={showDiscardModal}
            onCancel={() => setShowDiscardModal(false)}
            onConfirm={() => {
                setShowDiscardModal(false);
                if (onDiscard) onDiscard();
            }}
        />
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        // AJUSTE MOBILE: max-h-[90vh] e overflow-hidden para não estourar a tela
        className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col relative max-h-[90vh] overflow-hidden"
      >
        {/* HEADER */}
        {/* AJUSTE MOBILE: Padding reduzido (p-4) */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
             <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 rounded-2xl shadow-sm shrink-0">
                 <CheckCircle2 size={24} className="sm:w-8 sm:h-8" />
             </div>
             <div className="flex-1">
                 <h2 className="text-lg sm:text-2xl font-black text-zinc-800 dark:text-white uppercase tracking-tight leading-none">Sessão Finalizada</h2>
                 <p className="text-zinc-500 font-medium text-xs sm:text-sm mt-1 flex items-center gap-2"><Clock size={12} className="sm:w-[14px] sm:h-[14px]" /> {formatTime(timeMinutes)} de foco total</p>
             </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
             <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm w-full sm:w-auto">
                <BookOpen size={16} className="text-zinc-400 sm:w-[18px] sm:h-[18px]" />
                <span className="font-bold text-zinc-700 dark:text-zinc-200 text-xs sm:text-sm truncate max-w-[200px]">{erroDisciplina ? "Selecione..." : (disciplinaManual || disciplinaNome)}</span>
             </div>
             {/* BOTÃO RETOMAR REMOVIDO DAQUI CONFORME SOLICITADO */}
          </div>
        </div>

        {/* CONTENT - Com Scroll para telas pequenas */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1">
          {step === 1 ? (
            <div className="flex flex-col items-center justify-center py-4 sm:py-8 space-y-6 sm:space-y-8 h-full">
              <div className="text-center space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-white">Resolveu questões?</h3>
                <p className="text-zinc-500 text-sm sm:text-base max-w-xs mx-auto">Registre seu desempenho para alimentar as estatísticas de acertos.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-md">
                <button onClick={() => handleNext(false)} className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-3xl border-2 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group h-32 sm:h-40">
                  <XCircle size={32} className="sm:w-[48px] sm:h-[48px] text-zinc-300 group-hover:text-red-500 transition-colors" />
                  <span className="font-bold text-sm sm:text-lg text-zinc-600 dark:text-zinc-400 text-center">Apenas Estudo</span>
                </button>
                <button onClick={() => handleNext(true)} className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all group h-32 sm:h-40">
                  <Target size={32} className="sm:w-[48px] sm:h-[48px] text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-sm sm:text-lg text-emerald-700 dark:text-emerald-400 text-center">Sim, resolvi!</span>
                </button>
              </div>

              {/* --- BOTÕES DE AÇÃO SECUNDÁRIOS --- */}
              <div className="flex gap-3 sm:gap-4 mt-4 sm:mt-6 w-full max-w-md">

                  {/* BOTÃO DESCARTAR */}
                  {onDiscard && (
                      <button
                        onClick={() => setShowDiscardModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold uppercase text-[10px] sm:text-xs tracking-wider transition-all"
                      >
                          <Trash2 size={16} /> Descartar
                      </button>
                  )}

                  {/* BOTÃO RETOMAR ESTUDO (Grande) */}
                  <button
                    onClick={onCancel}
                    className="flex-[2] flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white font-bold uppercase text-[10px] sm:text-xs tracking-wider transition-all"
                  >
                      <RotateCcw size={16} /> Retomar
                  </button>
              </div>

            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8">

              {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2 animate-pulse">
                  <AlertTriangle size={18} /> {errorMessage}
                </div>
              )}

              {(erroDisciplina || !assuntosDisponiveis.length) && (
                  <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 shrink-0"><AlertTriangle size={20} /></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Atenção Necessária</p>
                          <select value={disciplinaManual} onChange={(e) => handleManualDisciplinaChange(e.target.value)} className="w-full p-2 rounded-lg bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-700 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-500">
                              <option value="">-- Selecione a Disciplina Correta --</option>
                              {todasDisciplinas.map((d, i) => (<option key={i} value={d.nome}>{d.nome}</option>))}
                          </select>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  <div className="space-y-4 sm:space-y-6">
                      <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2"><List size={14}/> Tópico Estudado</label>
                          <div className="relative">
                              <select
                                value={assuntoSelecionado}
                                onChange={(e) => setAssuntoSelecionado(e.target.value)}
                                disabled={loadingAssuntos || (erroDisciplina && !disciplinaManual)}
                                className="w-full p-3 sm:p-4 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-sm font-bold transition-all disabled:opacity-50"
                              >
                                  <option value="">-- Selecione o assunto --</option>
                                  {assuntosDisponiveis.map((assunto, i) => {
                                      const nome = typeof assunto === 'object' ? assunto.nome : assunto;
                                      return <option key={i} value={nome}>{nome}</option>
                                  })}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">{loadingAssuntos ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div> : <List size={16} />}</div>
                          </div>
                      </div>

                      {assuntoSelecionado && (
                          <div onClick={() => setMarkAsFinished(!markAsFinished)} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${markAsFinished ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300'}`}>
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${markAsFinished ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}><CheckSquare size={14} strokeWidth={4} /></div>
                              <div><p className={`text-sm font-bold ${markAsFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>Teoria Finalizada</p><p className="text-xs text-zinc-500">Marcar este tópico como concluído no edital.</p></div>
                          </div>
                      )}
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                      {hasQuestions ? (
                          <div className="space-y-4">
                            <NumberInputControl label="Total de Questões" value={questionsData.total} onChange={(val) => handleInputChange('total', val)} onIncrement={() => handleValueChange('total', 1)} onDecrement={() => handleValueChange('total', -1)} icon={Target} colorClass="text-zinc-400" />
                            <NumberInputControl label="Acertos" value={questionsData.correct} onChange={(val) => handleInputChange('correct', val)} onIncrement={() => handleValueChange('correct', 1)} onDecrement={() => handleValueChange('correct', -1)} icon={CheckCircle2} colorClass="text-emerald-500" />
                          </div>
                      ) : (
                          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 sm:p-6 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 h-full flex flex-col justify-center items-center">
                              <Target size={32} className="text-zinc-300 mb-2"/><p className="text-sm text-zinc-400 font-medium">Sem registro de questões</p>
                          </div>
                      )}
                  </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2"><FileText size={14}/> Anotações</label>
                  <textarea rows="3" value={obs} onChange={(e) => setObs(e.target.value)} className="w-full p-3 sm:p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none" placeholder="O que você aprendeu hoje?" />
              </div>

              <div className="flex gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-3 sm:py-4 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm sm:text-base">Voltar</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xl shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 text-base sm:text-lg"><Save size={20} className="sm:w-[22px] sm:h-[22px]" /> Salvar Sessão</button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default TimerFinishModal;