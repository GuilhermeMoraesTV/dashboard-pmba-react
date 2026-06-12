import React from 'react';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  CalendarClock, 
  ArrowLeft, 
  CheckCircle2, 
  Info
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 120 } }
};

const titleVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const CardPlanejamento = ({ 
  titulo, 
  subtitulo, 
  descricao, 
  vantagens, 
  icone: Icone, 
  onClick, 
  badge,
  isCycle
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={itemVariants}
      whileHover={{ y: -8, scale: 1.015 }}
      className={`relative group flex flex-col p-6 md:p-7 rounded-[2.2rem] border-2 transition-all duration-500 shadow-xl bg-white dark:bg-zinc-900 text-left w-full ${
        isCycle 
          ? 'border-red-100 dark:border-red-900/30 hover:border-red-500 hover:shadow-red-500/10' 
          : 'border-zinc-100 dark:border-zinc-800 hover:border-red-600 hover:shadow-red-600/10'
      }`}
    >
      <div className="absolute inset-0 rounded-[2.2rem] overflow-hidden pointer-events-none">
        <div className="absolute -right-6 -bottom-6 opacity-[0.05] dark:opacity-[0.08] transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12">
          <Icone size={220} strokeWidth={1.5} className="text-red-600 dark:text-red-500" />
        </div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/[0.05] to-transparent" />
      </div>

      {badge && (
        <div className="absolute top-5 right-5 z-10">
          <motion.span 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.15em] bg-red-600 text-white shadow-lg"
          >
            {badge}
          </motion.span>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/20 bg-red-600 text-white transition-all duration-500 group-hover:rotate-6">
          <Icone size={24} strokeWidth={2.5} />
        </div>

        <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none mb-2">
          {titulo}
        </h3>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-500 mb-4">
          {subtitulo}
        </p>

        <p className="text-[12px] md:text-[13px] text-zinc-500 dark:text-zinc-400 font-medium leading-snug mb-6">
          {descricao}
        </p>

        <div className="space-y-2.5 mb-8">
          {vantagens.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <div className="shrink-0 p-0.5 rounded-full bg-red-600/10 text-red-600">
                <CheckCircle2 size={12} strokeWidth={3} />
              </div>
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                {item}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 group-hover:text-red-600 transition-colors">
            Clique no card para iniciar
          </p>
        </div>
      </div>
    </motion.button>
  );
};

function PlanejamentoNovoPage({ onBack, onCriarCiclo, onCriarCronograma, hideBack = false }) {
  return (
    <div className="flex flex-col w-full relative pb-12 px-1">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/[0.02] dark:bg-red-600/[0.04] blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full relative z-10">
        {!hideBack && (
          <header className="flex items-center justify-start mb-10 md:mb-12">
            <motion.button
              whileHover={{ x: -3 }}
              onClick={onBack}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500 hover:text-red-600 transition-all shadow-sm"
            >
              <ArrowLeft size={14} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
              Voltar
            </motion.button>
          </header>
        )}

        <div className="text-center mb-12 md:mb-16">
          <motion.div
            variants={titleVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-4">
              Escolha sua <br />
              <span className="text-red-600">Estratégia de Vitória</span>
            </h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 60 }}
              className="h-1 bg-red-600 mx-auto rounded-full mb-5 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            />
            <p className="text-[10px] md:text-[11px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.25em] px-4">
              Otimize seu tempo e domine o conteúdo
            </p>
          </motion.div>
        </div>

        <div className="px-1 py-2">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 w-full max-w-5xl mx-auto"
          >
            <CardPlanejamento
              isCycle={true}
              icone={RefreshCw}
              titulo="Ciclo de Estudos"
              subtitulo="Adaptável & Fluido"
              badge="RECOMENDADO"
              descricao="Método dinâmico focado em progresso contínuo. Você segue uma sequência de matérias e avança no seu ritmo, sem a pressão de datas fixas."
              vantagens={[
                "Estude no seu ritmo disponível",
                "Ideal para rotinas variáveis",
                "Evita pular matérias difíceis",
                "Giro constante do edital"
              ]}
              onClick={onCriarCiclo}
            />

            <CardPlanejamento
              isCycle={false}
              icone={CalendarClock}
              titulo="Cronograma"
              subtitulo="Sólido & Disciplinado"
              descricao="Organização clássica por grade horária. Ideal para quem possui rotina estável e prefere horários definidos para cada disciplina."
              vantagens={[
                "Visão clara do estudo diário",
                "Organização por turnos fixos",
                "Cria disciplina por repetição",
                "Ideal para horários estáveis"
              ]}
              onClick={onCriarCronograma}
            />
          </motion.div>
        </div>

        <footer className="mt-16 text-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 shadow-sm"
          >
            <Info size={14} className="text-red-600" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400">
              Alterne entre os métodos quando desejar
            </span>
          </motion.div>
        </footer>
      </div>
    </div>
  );
}

export default PlanejamentoNovoPage;
