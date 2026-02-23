import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCiclos } from '../../../hooks/useCiclos';
import { db } from '../../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import {
  X, CheckCircle2, Target, Clock,
  ArrowRight, ArrowLeft, Layers, Plus,
  Grid, Type, Minus, Search,
  FileText, Star, Edit2, Library, BookOpen,
  Shield, BadgeAlert, Globe, Lock, Flame, Siren, Briefcase
} from 'lucide-react';

import ModalSelecaoEdital from './ModalSelecaoEdital';
import GradeHorarios from './GradeHorarios';
import RadarCiclo from './RadarCiclo';
import ItemDisciplina from './ItemDisciplina';

import { CATALOGO_EDITAIS } from '../../../pages/AdminPage/EditaisManager';

// ==================================================================================
// 🔧 CONFIGURAÇÃO DE LAYOUT DO WIZARD
// ==================================================================================
const WIZARD_LAYOUT = {
    mobile: { width: 'w-[95%]', maxHeight: 'max-h-[85vh]', marginTop: 'mt-20', marginBottom: 'mb-4' },
    desktop: { maxHeight: 'md:max-h-[85vh]', marginTop: 'md:mt-17', marginBottom: 'md:mb-0', marginLeft: 'md:ml-0', widthStep1: 'md:max-w-md', widthStepWide: 'md:max-w-5xl' },
    zIndex: 'z-[90]',
};

// ... (CONFIG_PESO, CONFIG_CATEGORIAS e formatarHoras mantidos)
const CONFIG_PESO = {
    1: { label: 'Mínima', description: 'Apenas Revisão', color: 'text-emerald-500', fill: 'fill-emerald-500', bg: 'bg-emerald-50' },
    2: { label: 'Baixa', description: 'Estudo Leve', color: 'text-green-500', fill: 'fill-green-500', bg: 'bg-green-50' },
    3: { label: 'Média', description: 'Estudo Regular', color: 'text-yellow-500', fill: 'fill-yellow-500', bg: 'bg-yellow-50' },
    4: { label: 'Alta', description: 'Estudo Focado', color: 'text-orange-500', fill: 'fill-orange-500', bg: 'bg-orange-50' },
    5: { label: 'Máxima', description: 'Prioridade Total', color: 'text-red-600', fill: 'fill-red-600', bg: 'bg-red-50' },
};

const CONFIG_CATEGORIAS = {
    pm: { label: 'Polícia Militar', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    pc: { label: 'Polícia Civil', icon: BadgeAlert, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    federal: { label: 'Carreiras Federais', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    pp: { label: 'Polícia Penal', icon: Lock, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
    cbm: { label: 'Corpo de Bombeiros', icon: Flame, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    gcm: { label: 'Guarda Municipal', icon: Siren, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    fa: { label: 'Forças Armadas', icon: Target, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    outros: { label: 'Outros Concursos', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
};

const formatarHoras = (horasDecimais) => {
  if (!horasDecimais || isNaN(horasDecimais)) return '0h';
  const totalMinutos = Math.round(horasDecimais * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

function CicloCreateWizard({ onClose, user, onCicloAtivado }) {
  const [passo, setPasso] = useState(1);
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [idModeloSelecionado, setIdModeloSelecionado] = useState(null);
  const [dadosModeloSelecionado, setDadosModeloSelecionado] = useState(null);
  const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('grade');
  const [cargaHorariaManual, setCargaHorariaManual] = useState(0);
  const [gradeDisponibilidade, setGradeDisponibilidade] = useState({});
  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [novoPeso, setNovoPeso] = useState(3);
  const [modelos, setModelos] = useState([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);

  // ESTADO QUE CONTROLA A TROCA DE TELAS
  const [mostrarModalModelo, setMostrarModalModelo] = useState(false);

  const { criarCiclo, loading } = useCiclos(user);

  // Scroll Block global
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.overscrollBehavior = '';
    };
  }, []);

  useEffect(() => {
      const buscarModelos = async () => {
          setCarregandoModelos(true);
          try {
              const querySnapshot = await getDocs(collection(db, "editais_templates"));
              const firestoreTemplates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              const firestoreMap = new Map(firestoreTemplates.map(t => [t.id, t]));

              const localSeedsProcessed = CATALOGO_EDITAIS
                .filter(seed => !firestoreMap.get(seed.id)?.deleted)
                .map(seed => {
                    const fromDb = firestoreMap.get(seed.id);
                    if (fromDb) {
                        firestoreMap.delete(seed.id);
                        return { ...seed, ...fromDb, logo: fromDb.logoUrl || fromDb.logo || seed.logo, isLocal: true, isInstalled: true };
                    }
                    return { ...seed, isLocal: true, isInstalled: false };
                });

              const customTemplates = Array.from(firestoreMap.values())
                .filter(t => !t.deleted)
                .map(t => ({ ...t, logo: t.logoUrl || t.logo, type: t.tipo || 'outros', isCustom: true, isInstalled: true, ativo: t.ativo !== undefined ? t.ativo : true }));

              setModelos([...localSeedsProcessed, ...customTemplates]);
          } catch (error) { console.error("❌ Erro ao carregar templates:", error); }
          finally { setCarregandoModelos(false); }
      };
      buscarModelos();
  }, []);

  const horasTotais = useMemo(() => {
      const manual = parseFloat(cargaHorariaManual) || 0;
      const grade = Object.keys(gradeDisponibilidade).length;
      return metodoCargaHoraria === 'manual' ? manual : grade;
  }, [metodoCargaHoraria, cargaHorariaManual, gradeDisponibilidade]);

  const disciplinasComCalculo = useMemo(() => {
      const pesoTotal = disciplinas.reduce((acc, d) => acc + (d.peso || 1), 0);
      return disciplinas.map(d => {
          const razao = pesoTotal > 0 ? (d.peso || 1) / pesoTotal : 0;
          const horas = razao * horasTotais;
          return { ...d, horasCalculadas: horas };
      });
  }, [disciplinas, horasTotais]);

  const selecionarModelo = (modelo) => {
      setIdModeloSelecionado(modelo.id);
      setDadosModeloSelecionado(modelo);

      // ✅ AQUI: Ao selecionar, fechamos o modal de seleção e o Wizard "reaparece"
      setMostrarModalModelo(false);

      setNomeCiclo(modelo.titulo);

      const disciplinasFormatadas = (modelo.disciplinas || []).map((d, index) => {
          let pesoInicial = d.peso || d.peso_sugerido || 3;
          const assuntosLimpos = (d.assuntos || []).map(item => (typeof item === 'string' ? item : item?.nome || "")).filter(i => i !== "");
          return {
              id: `imported-${Date.now()}-${index}`,
              nome: d.nome,
              peso: Math.max(1, Math.min(5, Number(pesoInicial))),
              assuntos: assuntosLimpos,
              index: index
          };
      });
      setDisciplinas(disciplinasFormatadas);
  };

  const selecionarManual = () => {
      setIdModeloSelecionado('manual');
      setDadosModeloSelecionado(null);
      setNomeCiclo('');
      setDisciplinas([]);
  };

  const adicionarDisciplina = (e) => {
      e.preventDefault();
      if (!nomeNovaDisciplina.trim()) return;
      setDisciplinas(prev => [...prev, { id: `new-${Date.now()}`, nome: nomeNovaDisciplina.trim(), peso: novoPeso, assuntos: [], index: prev.length }]);
      setNomeNovaDisciplina('');
      setNovoPeso(3);
  };

  const atualizarDisciplina = (id, novosDados) => setDisciplinas(prev => prev.map(d => d.id === id ? novosDados : d));
  const removerDisciplina = (id) => { if (window.confirm("Remover esta disciplina?")) setDisciplinas(prev => prev.filter(d => d.id !== id)); };

  const finalizarCriacao = async () => {
      if (horasTotais <= 0) return alert("Por favor, defina uma carga horária maior que zero.");
      if (disciplinas.length === 0) return alert("Adicione pelo menos uma disciplina ao ciclo.");

      const isManual = idModeloSelecionado === 'manual' || !idModeloSelecionado;
      const logoFinal = isManual ? null : (dadosModeloSelecionado?.logoUrl || dadosModeloSelecionado?.logo || null);

      const dadosCiclo = {
          nome: nomeCiclo,
          cargaHorariaTotal: Number(horasTotais),
          templateId: isManual ? 'manual' : idModeloSelecionado,
          editalId: isManual ? 'manual' : idModeloSelecionado,
          tipo: isManual ? 'manual' : 'padrao',
          criadoEm: new Date(),
          logoUrl: logoFinal,
          disciplinas: disciplinasComCalculo.map((d, position) => ({
              nome: d.nome,
              assuntos: d.assuntos,
              peso: d.peso,
              tempoAlocadoSemanalMinutos: Math.round(d.horasCalculadas * 60),
              index: position
          }))
      };

      const novoId = await criarCiclo(dadosCiclo);
      if (novoId) { onClose(); if (onCicloAtivado) onCicloAtivado(novoId); }
  };

  // ✅ LÓGICA DE RENDERIZAÇÃO EXCLUSIVA
  // Se o usuário clicar em "Selecionar Edital", retornamos APENAS o Modal de Seleção.
  // O Wizard "desaparece" momentaneamente.
  if (mostrarModalModelo) {
      return (
          <ModalSelecaoEdital
              aberto={true} // Sempre aberto quando renderizado aqui
              aoFechar={() => setMostrarModalModelo(false)} // Ao fechar, volta pro Wizard
              modelos={modelos}
              aoSelecionar={selecionarModelo} // Ao selecionar, volta pro Wizard com dados
              carregando={carregandoModelos}
              configCategorias={CONFIG_CATEGORIAS}
          />
      );
  }

  // ✅ Se não estiver mostrando o modal de seleção, mostra o Wizard normal
  const isWide = passo >= 2;
  const maxWidthClass = isWide ? WIZARD_LAYOUT.desktop.widthStepWide : WIZARD_LAYOUT.desktop.widthStep1;

  return (
    <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm ${WIZARD_LAYOUT.zIndex} flex items-center justify-center p-4 overflow-hidden touch-none`}>
      <motion.div
        layout
        className={`
            bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full flex flex-col relative transition-all duration-500

            ${maxWidthClass}
            ${WIZARD_LAYOUT.mobile.width}
            ${WIZARD_LAYOUT.mobile.marginTop}
            ${WIZARD_LAYOUT.mobile.marginBottom}
            ${WIZARD_LAYOUT.mobile.maxHeight}

            ${WIZARD_LAYOUT.desktop.marginTop}
            ${WIZARD_LAYOUT.desktop.marginBottom}
            ${WIZARD_LAYOUT.desktop.marginLeft}
            ${WIZARD_LAYOUT.desktop.maxHeight}

            ${passo === 3 ? 'h-[80vh]' : 'h-auto'}
        `}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >

        <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0">
            {passo === 1 && <FileText size={250} className="text-red-600" />}
            {passo === 2 && <Clock size={250} className="text-red-600" />}
            {passo === 3 && <Layers size={250} className="text-red-600" />}
        </div>

        {/* HEADER */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur rounded-t-3xl z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                    {passo === 1 ? <Target size={20}/> : passo === 2 ? <Clock size={20}/> : <Layers size={20}/>}
                </div>
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-none">Novo Ciclo</h2>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide">
                      {passo === 1 ? '1. Escolha o tipo de Ciclo' : passo === 2 ? '2. Carga Horária' : '3. Estrutura do Edital'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20} /></button>
        </div>

        {/* BODY */}
        <div className={`flex-1 relative z-10 flex flex-col min-h-0 ${passo === 3 ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
          <AnimatePresence mode="wait">

            {/* PASSO 1 */}
             {passo === 1 && (
              <motion.div key="step1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 gap-6 min-h-[300px]">
                  {!idModeloSelecionado ? (
                    <div className="flex flex-col h-full w-full max-w-2xl">
                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-bold text-zinc-800 dark:text-white">Qual é o seu objetivo?</h3>
                            <p className="text-zinc-500 text-sm">Escolha um concurso base ou crie do zero.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={selecionarManual} className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group h-40 sm:h-48">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Plus size={28} className="text-zinc-500 dark:text-zinc-400 group-hover:text-red-500" />
                                </div>
                                <span className="font-black text-lg text-zinc-700 dark:text-zinc-300 group-hover:text-red-500">Ciclo Manual</span>
                                <span className="text-xs text-zinc-400 mt-1">Começar do zero</span>
                            </button>
                            <button onClick={() => setMostrarModalModelo(true)} className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group h-40 sm:h-48 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Library size={80}/></div>
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                    <Search size={28} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="font-black text-lg text-zinc-800 dark:text-white relative z-10">Selecionar Edital</span>
                                <span className="text-xs text-zinc-500 mt-1 relative z-10">Usar edital pronto</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md text-center">
                        {dadosModeloSelecionado && (dadosModeloSelecionado.logoUrl || dadosModeloSelecionado.logo) && (
                            <div className="mb-6 flex justify-center">
                                <motion.img
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={dadosModeloSelecionado.logoUrl || dadosModeloSelecionado.logo}
                                    className="h-24 w-auto object-contain drop-shadow-xl"
                                    alt="Logo do Edital"
                                />
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Nome do Ciclo</h3>
                        <div className="relative group mb-6">
                            <input type="text" value={nomeCiclo} onChange={(e) => setNomeCiclo(e.target.value)} className="w-full p-4 text-xl text-center font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300" placeholder="Ex: CFO PMBA 2025" autoFocus />
                            <Edit2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 opacity-50 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                    </div>
                )}
              </motion.div>
            )}

            {/* PASSO 2 */}
            {passo === 2 && (
              <motion.div key="step2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex-1 flex flex-col p-4 sm:p-6 pb-24">
                <div className="flex justify-center mb-4 flex-shrink-0">
                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => setMetodoCargaHoraria('grade')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'grade' ? 'bg-white dark:bg-zinc-800 shadow text-emerald-600 dark:text-white' : 'text-zinc-400'}`}><Grid size={14}/> Interativo</button>
                        <button onClick={() => setMetodoCargaHoraria('manual')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'manual' ? 'bg-white dark:bg-zinc-800 shadow text-red-600 dark:text-white' : 'text-zinc-400'}`}><Type size={14}/> Manual</button>
                    </div>
                </div>
                {metodoCargaHoraria === 'grade' && (
                    <p className="text-xs text-zinc-500 text-center mb-4 px-4 font-medium">Selecione ou arraste os horários livres na semana para calcular sua carga horária semanal de estudos.</p>
                )}
                <div className="flex-1 flex flex-col">
                    {metodoCargaHoraria === 'manual' ? (
                         <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[250px]">
                             <div className="flex items-center gap-4 sm:gap-6">
                                <button onClick={() => setCargaHorariaManual(p => Math.max(0, Number(p)-1))} className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Minus size={20}/></button>
                                <div className="w-20 sm:w-32 text-center">
                                    <input type="number" value={cargaHorariaManual} onChange={(e) => setCargaHorariaManual(e.target.value)} className="w-full text-center text-4xl sm:text-5xl font-black bg-transparent border-none focus:ring-0 outline-none text-zinc-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                                <button onClick={() => setCargaHorariaManual(p => Number(p)+1)} className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Plus size={20}/></button>
                            </div>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Horas Semanais</span>
                         </div>
                    ) : (
                         <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">
                             <GradeHorarios disponibilidade={gradeDisponibilidade} setDisponibilidade={setGradeDisponibilidade} />
                         </div>
                    )}
                </div>
              </motion.div>
            )}

            {/* PASSO 3 */}
            {passo === 3 && (
              <motion.div key="step3" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex-1 flex flex-col lg:flex-row p-4 gap-6 h-full min-h-0 overflow-hidden">
                  <div className="flex-1 flex flex-col gap-4 min-w-0 h-full overflow-hidden">
                      <form onSubmit={adicionarDisciplina} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-shrink-0 flex gap-3 items-center">
                         <div className="flex-1">
                            <div className="relative">
                                <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                                <input type="text" value={nomeNovaDisciplina} onChange={(e) => setNomeNovaDisciplina(e.target.value)} placeholder="Nova Disciplina..." className="w-full pl-14 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-zinc-400 border border-transparent" style={{ paddingLeft: '3.5rem' }} />
                            </div>
                            <div className="flex items-center gap-2 mt-2 px-1">
                                <span className="text-[10px] font-bold uppercase text-zinc-400">Prioridade:</span>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} type="button" onClick={() => setNovoPeso(star)} className="focus:outline-none transition-transform hover:scale-110 active:scale-95">
                                            <Star size={14} className={`${star <= novoPeso ? `${CONFIG_PESO[novoPeso].fill} ${CONFIG_PESO[novoPeso].color}` : 'text-zinc-300 dark:text-zinc-700'}`} />
                                        </button>
                                    ))}
                                </div>
                                <span className={`text-[10px] font-bold uppercase ml-1 ${CONFIG_PESO[novoPeso].color}`}>{CONFIG_PESO[novoPeso].label}</span>
                            </div>
                         </div>
                         <button type="submit" className="h-14 w-14 bg-zinc-900 dark:bg-zinc-700 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"><Plus size={24}/></button>
                      </form>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 pb-24 min-h-0">
                          {disciplinas.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                  <Layers size={64} className="text-zinc-300 mb-4"/>
                                  <p className="text-zinc-500 font-medium">Sua lista está vazia. Adicione disciplinas.</p>
                              </div>
                          )}
                          {disciplinasComCalculo.map(d => (
                              <ItemDisciplina key={d.id} disciplina={d} aoAtualizar={atualizarDisciplina} aoRemover={removerDisciplina} configPeso={CONFIG_PESO} formatarHoras={formatarHoras} />
                          ))}
                      </div>
                  </div>
                  <div className="w-full lg:w-80 flex-shrink-0 hidden lg:flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pb-20">
                      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center sticky top-0">
                         <div className="mb-6 text-center"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Raio-X do Ciclo</span></div>
                         <RadarCiclo disciplinas={disciplinasComCalculo} totalHoras={horasTotais} formatarHoras={formatarHoras} />
                         <div className="mt-8 text-center w-full">
                             <div className="flex justify-between items-end border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Disciplinas</span>
                                <span className="text-xl font-black text-zinc-900 dark:text-white">{disciplinas.length}</span>
                             </div>
                             <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Total Horas</span>
                                <span className="text-xl font-black text-red-600">{horasTotais}h</span>
                             </div>
                         </div>
                      </div>
                  </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER DE NAVEGAÇÃO */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-b-3xl z-20">
             <div className="flex justify-between items-center gap-2">
                 {passo > 1 || (passo === 1 && idModeloSelecionado) ? (
                     <button onClick={() => { if (passo === 1 && idModeloSelecionado) { setIdModeloSelecionado(null); setDadosModeloSelecionado(null); } else { setPasso(s => s - 1); } }} className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 font-bold text-[10px] sm:text-xs uppercase">
                        <ArrowLeft size={14} className="sm:w-4 sm:h-4"/> <span className="hidden sm:inline">Voltar</span>
                     </button>
                 ) : (
                     <button onClick={onClose} className="px-3 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-bold uppercase text-zinc-400 hover:text-zinc-600">Cancelar</button>
                 )}
                 {passo >= 2 && <div className="flex flex-col items-center"><span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span><span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none">{horasTotais}h</span></div>}
                 {passo < 3 ? (
                     <button onClick={() => setPasso(s => s + 1)} disabled={passo === 1 ? (!idModeloSelecionado && !nomeCiclo) : horasTotais <= 0} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold uppercase tracking-wide text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-1 transition-all flex items-center gap-2">Próximo <ArrowRight size={14} className="sm:w-4 sm:h-4"/></button>
                 ) : (
                     <button onClick={finalizarCriacao} disabled={disciplinas.length === 0 || loading} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">{loading ? "Criando..." : <><CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]"/> Finalizar</>}</button>
                 )}
             </div>
        </div>
      </motion.div>
    </div>
  );
}

export default CicloCreateWizard;