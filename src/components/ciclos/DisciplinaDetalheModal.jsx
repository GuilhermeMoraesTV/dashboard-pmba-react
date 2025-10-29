import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopicListPanel from './TopicListPanel';

const IconClose = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconQuestions = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
);
const IconTrophy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </svg>
);


const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0.0';
    return (minutos / 60).toFixed(1);
};


const StatCard = ({ icon, label, value, unit, colorClass }) => (
  <div className={`flex-1 p-5 rounded-xl bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color`}>
    <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-3 ${colorClass}/10`}>
      <span className={colorClass}>{icon}</span>
    </div>
    <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color mb-1">{label}</p>
    <p className="text-3xl font-bold text-heading-color dark:text-dark-heading-color">
      {value} <span className="text-lg font-medium">{unit}</span>
    </p>
  </div>
);

function DisciplinaDetalheModal({ disciplina, registrosEstudo, cicloId, user, onClose, onQuickAddTopic }) {

  const registrosDaDisciplina = useMemo(() => {
    if (!registrosEstudo || !disciplina) return [];
    return registrosEstudo.filter(r => r.disciplinaId === disciplina.id);
  }, [registrosEstudo, disciplina]);

  const stats = useMemo(() => {
    const totalMinutes = registrosDaDisciplina.reduce((sum, r) => sum + r.tempoEstudadoMinutos, 0);
    const totalQuestions = registrosDaDisciplina.reduce((sum, r) => sum + r.questoesFeitas, 0);
    const totalCorrect = registrosDaDisciplina.reduce((sum, r) => sum + r.acertos, 0);
    const performance = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    return {
      totalHours: formatDecimalHours(totalMinutes),
      totalQuestions: totalQuestions,
      performance: performance.toFixed(0),
    };
  }, [registrosDaDisciplina]);

  if (!disciplina) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // [CORREÇÃO 4] Aumentado z-index do backdrop
        className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: "100vh", opacity: 0 }}
          animate={{ y: "0vh", opacity: 1 }}
          exit={{ y: "100vh", opacity: 0 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
          // [CORREÇÃO 4] Aumentado z-index do conteúdo do modal
          className="relative w-full h-full bg-background-color dark:bg-dark-background-color flex flex-col z-[60]"
        >
          <div className="flex-shrink-0 p-6 flex items-center justify-between border-b border-border-color dark:border-dark-border-color">
            <div>
              <p className="text-sm font-semibold text-primary-color dark:text-dark-primary-color">
                Detalhes da Disciplina
              </p>
              <h1 className="text-3xl font-bold text-heading-color dark:text-dark-heading-color">
                {disciplina.nome}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-full text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-border-color dark:hover:bg-dark-border-color transition-colors"
            >
              <IconClose />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color mb-4">
                Desempenho Geral (Total)
              </h2>
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <StatCard
                  icon={<IconClock />}
                  label="Tempo Total"
                  value={stats.totalHours}
                  unit="horas"
                  colorClass="text-primary-color"
                />
                <StatCard
                  icon={<IconQuestions />}
                  label="Questões Totais"
                  value={stats.totalQuestions}
                  unit="questões"
                  colorClass="text-success-color"
                />
                <StatCard
                  icon={<IconTrophy />}
                  label="Acerto Médio"
                  value={stats.performance}
                  unit="%"
                  colorClass="text-warning-color"
                />
              </div>

              <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-lg p-4 md:p-6 border border-border-color dark:border-dark-border-color">
                  <TopicListPanel
                      // [CORREÇÃO 2] Passando user.uid (string)
                      user={user?.uid}
                      cicloId={cicloId}
                      disciplinaId={disciplina.id}
                      registrosEstudo={registrosDaDisciplina}
                      disciplinaNome="Progresso por Tópico"
                      onQuickAddTopic={onQuickAddTopic}
                  />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DisciplinaDetalheModal;