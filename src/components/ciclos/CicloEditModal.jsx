import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { useCiclos } from '../../hooks/useCiclos';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, PenTool, Clock, Layers,
  ArrowRight, ArrowLeft, Trash2, Plus,
  Minus, Grid, Type, Target
} from 'lucide-react';

// --- UTILITÁRIOS VISUAIS & CONVERSÃO ---
const toRad = (deg) => (deg * Math.PI) / 180;

const createArc = (start, end, r) => {
  if (Math.abs(end - start) >= 360) end = start + 359.99;
  const startRad = toRad(start - 90);
  const endRad = toRad(end - 90);
  const x1 = 50 + r * Math.cos(startRad);
  const y1 = 50 + r * Math.sin(startRad);
  const x2 = 50 + r * Math.cos(endRad);
  const y2 = 50 + r * Math.sin(endRad);
  const largeArcFlag = end - start <= 180 ? 0 : 1;
  return ["M", x1, y1, "A", r, r, 0, largeArcFlag, 1, x2, y2].join(" ");
};

const nivelToPeso = (nivel) => {
  if (nivel === 'Avançado') return 3;
  if (nivel === 'Medio') return 2;
  return 1;
};

const pesoToNivel = (peso) => {
  if (peso === 3) return 'Avançado';
  if (peso === 2) return 'Medio';
  return 'Iniciante';
};

// --- SUB-COMPONENTE: GRADE INTERATIVA (CALCULADORA) ---
const ScheduleGrid = ({ availability, setAvailability, onUpdateTotal }) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const toggleSlot = (dayIndex, hour) => {
    const key = `${dayIndex}-${hour}`;
    const newAvailability = { ...availability };
    if (newAvailability[key]) delete newAvailability[key];
    else newAvailability[key] = true;

    setAvailability(newAvailability);
    onUpdateTotal(Object.keys(newAvailability).length);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-8 gap-1 pr-2 mb-2 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 pt-2 pb-1 sticky top-0 z-10">
        <div className="text-[10px] font-black text-zinc-300 uppercase text-center pt-2">H</div>
        {days.map((d, i) => (
          <div key={i} className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase text-center">{d}</div>
        ))}
      </div>
      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 h-[300px]">
        <div className="space-y-1">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-1 items-center">
              <div className="text-xs sm:text-sm font-bold text-zinc-400 text-center">{h.toString().padStart(2, '0')}h</div>
              {days.map((d, dayIndex) => {
                const isSelected = availability[`${dayIndex}-${h}`];
                return (
                  <button
                    key={`${dayIndex}-${h}`}
                    onClick={() => toggleSlot(dayIndex, h)}
                    type="button"
                    className={`h-10 w-full rounded-md transition-all duration-100 border relative flex items-center justify-center group ${isSelected ? 'bg-emerald-500 border-emerald-600 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTE: PREVIEW TÁTICO ---
const CyclePreview = ({ disciplinas, totalHours }) => {
  const data = useMemo(() => {
    if (!disciplinas.length) return [];
    const totalWeight = disciplinas.reduce((acc, d) => acc + d.peso, 0);
    let currentAngle = 0;
    return disciplinas.map((d, index) => {
      const angle = totalWeight > 0 ? (d.peso / totalWeight) * 360 : 0;
      const hours = totalWeight > 0 ? (d.peso / totalWeight) * totalHours : 0;
      const baseColor = index % 2 === 0 ? '#52525b' : '#71717a';
      const item = { ...d, hours, startAngle: currentAngle, angle, color: baseColor };
      currentAngle += angle;
      return item;
    });
  }, [disciplinas, totalHours]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
      <div className="w-48 h-48 relative">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
           {data.length === 0 && <circle cx="50" cy="50" r="42" stroke="#e4e4e7" strokeWidth="12" fill="none" opacity="0.3" />}
           {data.map((seg) => (
             <path key={seg.id || Math.random()} d={createArc(seg.startAngle, seg.startAngle + (seg.angle > 2 ? seg.angle - 2 : seg.angle), 42)} fill="none" stroke={seg.color} strokeWidth="12" />
           ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-zinc-300 dark:text-zinc-700 leading-none">{disciplinas.length}</span>
            <span className="text-[8px] font-bold text-zinc-400 uppercase">Disciplinas</span>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
function CicloEditModal({ onClose, user, ciclo }) {
  // Estados de Controle
  const [etapa, setEtapa] = useState(1);
  const [loadingData, setLoadingData] = useState(true);

  // Estados de Dados
  const [nome, setNome] = useState('');

  // Controle de Horas (Híbrido Manual/Grade)
  const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('manual');
  const [cargaHorariaManual, setCargaHorariaManual] = useState(0);
  const [availabilityGrid, setAvailabilityGrid] = useState({});

  // Disciplinas
  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [pesoNovaDisciplina, setPesoNovaDisciplina] = useState(1);

  const { editarCiclo, loading } = useCiclos(user);

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (!user || !ciclo) return;
    const carregarDados = async () => {
      setLoadingData(true);
      try {
        setNome(ciclo.nome);
        setCargaHorariaManual(ciclo.cargaHorariaSemanalTotal || 0);

        const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'disciplinas');
        const snap = await getDocs(disciplinasRef);
        const data = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            peso: doc.data().peso || nivelToPeso(doc.data().nivel || doc.data().nivelProficiencia)
        }));
        setDisciplinas(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    };
    carregarDados();
  }, [user, ciclo]);

  // Cálculo de Total de Horas
  const horasTotais = useMemo(() => {
    if (metodoCargaHoraria === 'manual') return parseFloat(cargaHorariaManual) || 0;
    return Object.keys(availabilityGrid).length;
  }, [metodoCargaHoraria, cargaHorariaManual, availabilityGrid]);

  // Handler Grade
  const handleUpdateTotalFromGrid = (total) => {
      // O grid atualiza o visual, mas o valor real de horasTotais vem do length da grid
  };

  // Manipulação de Disciplinas
  const handleAddDisciplina = (e) => {
    e.preventDefault();
    if (!nomeNovaDisciplina.trim()) return;
    setDisciplinas([...disciplinas, {
        id: `temp-${Date.now()}`,
        nome: nomeNovaDisciplina.trim(),
        peso: pesoNovaDisciplina
    }]);
    setNomeNovaDisciplina('');
    setPesoNovaDisciplina(1);
  };

  const handleUpdateDisciplina = (index, field, value) => {
    const updated = [...disciplinas];
    updated[index][field] = value;
    setDisciplinas(updated);
  };

  const handleRemoveDisciplina = (index) => {
    const updated = [...disciplinas];
    updated.splice(index, 1);
    setDisciplinas(updated);
  };

  // Salvar
  const handleSave = async () => {
    if (disciplinas.length === 0 || horasTotais <= 0) {
      alert("Verifique os dados.");
      return;
    }
    const cicloData = {
      nome,
      cargaHorariaTotal: horasTotais,
      disciplinas: disciplinas.map(d => ({
        ...d,
        peso: d.peso,
        nivel: pesoToNivel(d.peso),
        // Recalcular meta de horas baseado na nova carga horaria total
        tempoAlocadoSemanalMinutos: (d.peso / disciplinas.reduce((acc, curr) => acc + curr.peso, 0)) * horasTotais * 60
      })),
    };
    if (await editarCiclo(ciclo.id, cicloData)) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">

      <motion.div
        layout
        className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl flex flex-col relative transition-all duration-500 max-h-[95vh]"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >

        {loadingData && (
          <div className="absolute inset-0 z-50 bg-white/80 dark:bg-zinc-950/80 flex items-center justify-center rounded-3xl backdrop-blur-sm">
             <div className="animate-spin w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Watermark */}
        <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0">
            {etapa === 1 ? <Target size={250} className="text-red-600"/> :
             etapa === 2 ? <Clock size={250} className="text-red-600"/> :
             <Layers size={250} className="text-red-600"/>}
        </div>

        {/* HEADER */}
        <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur rounded-t-3xl z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center justify-center border border-zinc-300 dark:border-zinc-700">
                    <PenTool size={20}/>
                </div>
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-none">Editar Ciclo</h2>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide">
                        {etapa === 1 ? '1. Identificação' : etapa === 2 ? '2. Carga Horária' : '3. Disciplinas'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-red-500 rounded-full transition-all"><X size={20} /></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col p-6">
          {!loadingData && (
             <AnimatePresence mode="wait">

                {/* ETAPA 1: NOME */}
                {etapa === 1 && (
                  <motion.div key="step1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col gap-6 items-center justify-center min-h-[300px]">
                     <div className="w-full max-w-md text-center">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Nome da Missão</label>
                        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-4 text-xl text-center font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-zinc-900 dark:text-white"/>
                     </div>
                  </motion.div>
                )}

                {/* ETAPA 2: HORAS */}
                {etapa === 2 && (
                   <motion.div key="step2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex flex-col h-full">
                       <div className="flex justify-center mb-6">
                           <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                               <button onClick={() => setMetodoCargaHoraria('manual')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 ${metodoCargaHoraria === 'manual' ? 'bg-white dark:bg-zinc-800 shadow text-red-600 dark:text-white' : 'text-zinc-400'}`}><Type size={14}/> Manual</button>
                               <button onClick={() => setMetodoCargaHoraria('grade')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 ${metodoCargaHoraria === 'grade' ? 'bg-white dark:bg-zinc-800 shadow text-emerald-600 dark:text-white' : 'text-zinc-400'}`}><Grid size={14}/> Interativo</button>
                           </div>
                       </div>

                       <div className="flex-1 flex flex-col">
                           {metodoCargaHoraria === 'manual' ? (
                               <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[250px]">
                                   <div className="flex items-center gap-6">
                                       <button onClick={() => setCargaHorariaManual(p => Math.max(0, Number(p)-1))} className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 flex items-center justify-center shadow-sm"><Minus size={20}/></button>
                                       <div className="w-32 text-center"><input type="number" value={cargaHorariaManual} onChange={(e) => setCargaHorariaManual(e.target.value)} className="w-full text-center text-5xl font-black bg-transparent border-none focus:ring-0 outline-none text-zinc-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none" /></div>
                                       <button onClick={() => setCargaHorariaManual(p => Number(p)+1)} className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 flex items-center justify-center shadow-sm"><Plus size={20}/></button>
                                   </div>
                                   <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Horas Semanais</span>
                               </div>
                           ) : (
                               <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">
                                   <ScheduleGrid availability={availabilityGrid} setAvailability={setAvailabilityGrid} onUpdateTotal={handleUpdateTotalFromGrid} />
                               </div>
                           )}
                       </div>
                   </motion.div>
                )}

                {/* ETAPA 3: DISCIPLINAS */}
                {etapa === 3 && (
                  <motion.div key="step3" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex flex-col lg:flex-row gap-6 h-full">
                      {/* Lista Editável */}
                      <div className="flex-1 flex flex-col gap-4">
                          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-shrink-0">
                              <form onSubmit={handleAddDisciplina} className="flex gap-2">
                                 <input type="text" value={nomeNovaDisciplina} onChange={(e) => setNomeNovaDisciplina(e.target.value)} placeholder="Nova disciplina..." className="flex-1 p-2 font-bold rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" />
                                 <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    {[1,2,3].map(v => (
                                        <button key={v} type="button" onClick={() => setPesoNovaDisciplina(v)} className={`px-2 rounded text-xs font-black transition-all ${pesoNovaDisciplina === v ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>{v}</button>
                                    ))}
                                 </div>
                                 <button type="submit" className="px-3 bg-red-600 text-white rounded-lg hover:bg-red-700"><Plus size={18}/></button>
                              </form>
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-[200px]">
                              {disciplinas.map((d, index) => (
                                  <div key={d.id || index} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm group hover:border-zinc-300 dark:hover:border-zinc-700">
                                      <div className="flex-1 mr-4">
                                          <input
                                            type="text"
                                            value={d.nome}
                                            onChange={(e) => handleUpdateDisciplina(index, 'nome', e.target.value)}
                                            className="w-full bg-transparent font-bold text-zinc-800 dark:text-white border-b border-transparent focus:border-red-500 outline-none text-sm mb-1"
                                          />
                                          <div className="flex gap-1">
                                              {[1,2,3].map(v => (
                                                  <button
                                                    key={v}
                                                    onClick={() => handleUpdateDisciplina(index, 'peso', v)}
                                                    className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${d.peso === v ? 'bg-zinc-800 text-white border-zinc-800' : 'text-zinc-400 border-zinc-200 dark:border-zinc-800'}`}
                                                  >
                                                      Peso {v}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                      <button onClick={() => handleRemoveDisciplina(index)} className="p-2 text-zinc-300 hover:text-red-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg"><Trash2 size={16}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Preview */}
                      <div className="w-full lg:w-1/3">
                          <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 h-full">
                              <CyclePreview disciplinas={disciplinas} totalHours={horasTotais} />
                          </div>
                      </div>
                  </motion.div>
                )}
             </AnimatePresence>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-b-3xl z-20 flex justify-between items-center">
             {/* Esquerda */}
             {etapa === 1 ? (
                 <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-600">Cancelar</button>
             ) : (
                 <button onClick={() => setEtapa(e => e - 1)} className="px-4 py-2 rounded-xl text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/> Voltar</button>
             )}

             {/* Centro (Total) */}
             {etapa >= 2 && (
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-500 leading-none">{horasTotais}h</span>
                 </div>
             )}

             {/* Direita */}
             {etapa < 3 ? (
                 <button onClick={() => setEtapa(e => e + 1)} disabled={etapa===1 && !nome} className="px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-lg disabled:opacity-50 hover:translate-x-1 transition-all flex items-center gap-2">Avançar <ArrowRight size={16}/></button>
             ) : (
                 <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2">{loading ? "Salvando..." : <><Save size={18}/> Salvar</>}</button>
             )}
        </div>

      </motion.div>
    </div>
  );
}

export default CicloEditModal;