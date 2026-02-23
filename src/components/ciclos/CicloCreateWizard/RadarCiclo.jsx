import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Funções matemáticas locais deste componente
const paraRadianos = (graus) => (graus * Math.PI) / 180;

const criarArco = (inicio, fim, r) => {
  if (Math.abs(fim - inicio) >= 360) fim = inicio + 359.99;
  const radInicio = paraRadianos(inicio - 90);
  const radFim = paraRadianos(fim - 90);
  const x1 = 50 + r * Math.cos(radInicio);
  const y1 = 50 + r * Math.sin(radInicio);
  const x2 = 50 + r * Math.cos(radFim);
  const y2 = 50 + r * Math.sin(radFim);
  const flagArcoGrande = fim - inicio <= 180 ? 0 : 1;
  return ["M", x1, y1, "A", r, r, 0, flagArcoGrande, 1, x2, y2].join(" ");
};

const RadarCiclo = ({ disciplinas, totalHoras, formatarHoras }) => {
  const [idEmFoco, setIdEmFoco] = useState(null);

  const dados = useMemo(() => {
    if (!disciplinas.length) return [];
    const pesoTotal = disciplinas.reduce((acc, d) => acc + (d.peso || 1), 0);
    let anguloAtual = 0;
    return disciplinas.map((d, index) => {
      const p = d.peso || 1;
      const angulo = pesoTotal > 0 ? (p / pesoTotal) * 360 : 0;
      const horas = pesoTotal > 0 ? (p / pesoTotal) * totalHoras : 0;
      const corBase = index % 2 === 0 ? '#52525b' : '#71717a';
      const item = { ...d, horas, anguloInicial: anguloAtual, angulo, cor: corBase };
      anguloAtual += angulo;
      return item;
    });
  }, [disciplinas, totalHoras]);

  const itemAtivo = useMemo(() => idEmFoco ? dados.find(d => d.id === idEmFoco) : null, [idEmFoco, dados]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[250px]">
      <div className="w-56 h-56 relative group cursor-crosshair">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
           {dados.length === 0 && (<circle cx="50" cy="50" r="42" stroke="#e4e4e7" strokeWidth="12" fill="none" className="dark:stroke-zinc-800" opacity="0.3" />)}
           {dados.map((seg) => {
             const gap = 2; const anguloVisual = seg.angulo > gap ? seg.angulo - gap : seg.angulo;
             const caminhoBg = criarArco(seg.anguloInicial, seg.anguloInicial + anguloVisual, 42);
             const estaEmFoco = idEmFoco === seg.id;
             return (<motion.path key={seg.id} d={caminhoBg} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1, stroke: estaEmFoco ? '#dc2626' : seg.cor, scale: estaEmFoco ? 1.05 : 1 }} transition={{ duration: 0.3 }} fill="none" strokeWidth={estaEmFoco ? 14 : 12} strokeLinecap="butt" onMouseEnter={() => setIdEmFoco(seg.id)} onMouseLeave={() => setIdEmFoco(null)} />);
           })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
             <AnimatePresence mode="wait">
                 {itemAtivo ? (
                    <motion.div key="active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center text-center px-2">
                        <span className="text-[10px] font-black text-red-600 uppercase mb-0.5 line-clamp-1 max-w-[90px]">{itemAtivo.nome}</span>
                        <span className="text-3xl font-black text-zinc-800 dark:text-white leading-none">{formatarHoras(itemAtivo.horas)}</span>
                    </motion.div>
                 ) : (
                    <motion.div key="default" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center">
                        <span className="text-4xl font-black text-zinc-300 dark:text-zinc-700 tracking-tighter leading-none">{disciplinas.length}</span>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Disciplinas</span>
                    </motion.div>
                 )}
             </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default RadarCiclo;