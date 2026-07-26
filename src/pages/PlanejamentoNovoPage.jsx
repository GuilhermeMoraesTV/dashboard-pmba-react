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
  const tituloMobile = isCycle ? 'Ciclo' : 'Cronograma';
  const subtituloMobile = isCycle ? 'Flexivel' : 'Agenda fixa';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={itemVariants}
      whileHover={{ y: -8, scale: 1.015 }}
      className={`relative group flex min-h-[124px] flex-col rounded-2xl border-2 bg-white p-2.5 text-left shadow-md transition-all duration-500 dark:bg-zinc-900 sm:min-h-[260px] sm:p-6 md:p-7 md:rounded-[2.2rem] md:shadow-xl ${
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
        <div className="absolute top-2 right-2 z-10 sm:top-5 sm:right-5">
          <motion.span 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-[0.08em] bg-red-600 text-white shadow-lg sm:px-3 sm:py-1 sm:text-[8px] sm:tracking-[0.15em]"
          >
            <span className="sm:hidden">Top</span>
            <span className="hidden sm:inline">{badge}</span>
          </motion.span>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all duration-500 group-hover:rotate-6 sm:mb-6 sm:h-12 sm:w-12">
          <Icone size={16} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </div>

        <h3 className="mb-1 text-[13px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white sm:mb-2 sm:text-xl md:text-2xl">
          <span className="sm:hidden">{tituloMobile}</span>
          <span className="hidden sm:inline">{titulo}</span>
        </h3>
        <p className="mb-0 text-[7px] font-black uppercase tracking-[0.1em] text-red-600 dark:text-red-500 sm:mb-4 sm:text-[9px] sm:tracking-[0.2em]">
          <span className="sm:hidden">{subtituloMobile}</span>
          <span className="hidden sm:inline">{subtitulo}</span>
        </p>

        <p className="mb-3 hidden line-clamp-3 text-[9px] font-medium leading-snug text-zinc-500 dark:text-zinc-400 sm:mb-6 sm:block sm:text-[12px] md:text-[13px]">
          {descricao}
        </p>

        <div className="mb-4 hidden space-y-1.5 sm:mb-8 sm:block sm:space-y-2.5">
          {vantagens.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="shrink-0 p-0.5 rounded-full bg-red-600/10 text-red-600">
                <CheckCircle2 size={9} strokeWidth={3} className="sm:h-3 sm:w-3" />
              </div>
              <span className="truncate text-[8px] font-bold text-zinc-600 dark:text-zinc-300 sm:text-[11px]">
                {item}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto hidden pt-1 sm:block">
          <p className="text-[7px] font-black uppercase tracking-[0.1em] text-zinc-400 transition-colors group-hover:text-red-600 sm:text-[10px] sm:tracking-[0.14em]">
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

        <div className="mb-4 text-center md:mb-16">
          <motion.div
            variants={titleVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="mb-2 text-xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:text-2xl md:mb-4 md:text-4xl">
              Escolha sua <br />
              <span className="text-red-600">Estratégia de Estudo</span>
            </h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 60 }}
              className="h-1 bg-red-600 mx-auto rounded-full mb-3 sm:mb-5 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            />
            <p className="hidden text-[10px] md:text-[11px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.25em] px-4 sm:block">
              Otimize seu tempo e domine o conteúdo
            </p>
          </motion.div>
        </div>

        <div className="px-1 py-2">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 sm:gap-6 lg:gap-10"
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

        <footer className="mt-8 text-center sm:mt-16">
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
