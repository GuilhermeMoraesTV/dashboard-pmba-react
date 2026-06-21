import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Library, CheckCircle2, ArrowRight, Layers, Sparkles,
    Search, Filter, ChevronDown, Briefcase,
    ShieldAlert, Globe, BadgeAlert, Lock, Flame, Siren, LayoutGrid, RefreshCw, Target
} from 'lucide-react';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

// ==================================================================================
// 🔧 CONFIGURAÇÃO DE LAYOUT
// ==================================================================================
const MODAL_LAYOUT = {
    mobile: { width: 'w-[95%]', maxHeight: 'max-h-[85vh]', marginTop: 'mt-0', marginBottom: 'mb-0' },
    desktop: { maxWidth: 'md:max-w-5xl', maxHeight: 'md:max-h-[85vh]', marginTop: 'md:mt-0', marginBottom: 'md:mb-0', marginLeft: 'md:ml-0' },
    zIndex: 'z-[100]',
};

const CATEGORIA_CONFIG = {
    pm:      { icon: ShieldAlert, bg: 'bg-zinc-100 dark:bg-zinc-800',         color: 'text-zinc-700 dark:text-zinc-300',     label: 'Polícia Militar' },
    pc:      { icon: BadgeAlert,  bg: 'bg-zinc-100 dark:bg-zinc-800',         color: 'text-zinc-700 dark:text-zinc-300',     label: 'Polícia Civil' },
    pp:      { icon: Lock,        bg: 'bg-zinc-100 dark:bg-zinc-800',         color: 'text-zinc-700 dark:text-zinc-300',     label: 'Polícia Penal' },
    cbm:     { icon: Flame,       bg: 'bg-red-50 dark:bg-red-900/20',         color: 'text-red-600 dark:text-red-400',       label: 'Bombeiros Militar' },
    gcm:     { icon: Siren,       bg: 'bg-blue-50 dark:bg-blue-900/20',       color: 'text-blue-500 dark:text-blue-400',     label: 'Guarda Municipal' },
    fa:      { icon: Target,      bg: 'bg-green-50 dark:bg-green-900/20',     color: 'text-green-700 dark:text-green-400',   label: 'Forças Armadas' },
    federal: { icon: Globe,       bg: 'bg-blue-50 dark:bg-blue-900/20',       color: 'text-blue-600 dark:text-blue-400',     label: 'Carreiras Federais' },
    adm:     { icon: Briefcase,   bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-600 dark:text-emerald-400', label: 'Administrativos' },
};

const CardEdital = ({ dados, unico, idSelecionado, aoDestacar, aoConfirmar, aoClickCard }) => {
    const editalBase = unico ? dados : dados[0];
    const variosCargos = !unico;
    const [menuAberto, setMenuAberto] = useState(false);

    const itemSelecionadoDoGrupo = unico
        ? (idSelecionado === dados.id ? dados : null)
        : dados.find(d => d.id === idSelecionado);
    const estaSelecionado = !!itemSelecionadoDoGrupo;

    const tituloExibicao = variosCargos
        ? (editalBase.instituicao || editalBase.titulo.split(' - ')[0])
        : editalBase.titulo;

    const qtdDisciplinas = itemSelecionadoDoGrupo
        ? (itemSelecionadoDoGrupo.disciplinas?.length || 0)
        : (editalBase.disciplinas?.length || 0);

    const handleAction = (e) => {
        e.stopPropagation();
        if (variosCargos) setMenuAberto(!menuAberto);
        else if (estaSelecionado) aoConfirmar(dados);
        else aoDestacar(dados);
    };

    const selecionarSubItem = (e, item) => {
        e.stopPropagation();
        aoDestacar(item);
        setMenuAberto(false);
    };

    const handleConfirmarGrupo = (e) => {
        e.stopPropagation();
        if (itemSelecionadoDoGrupo) aoConfirmar(itemSelecionadoDoGrupo);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className={`
                relative flex flex-col rounded-xl overflow-hidden
                group text-left transition-all duration-300 cursor-pointer
                w-[148px] h-[272px]
                sm:w-[190px] sm:h-[310px]
                md:w-[210px] md:h-[330px]
                flex-shrink-0 select-none
                ${estaSelecionado
                    ? 'bg-gradient-to-br from-red-50 via-white to-red-50/30 dark:from-red-950/20 dark:via-zinc-900 dark:to-red-950/10 border-2 border-red-500 shadow-2xl shadow-red-500/25 ring-4 ring-red-500/10'
                    : 'bg-white dark:bg-zinc-900 border-2 border-zinc-200/60 dark:border-zinc-800/60 shadow-lg hover:shadow-2xl hover:border-red-300 dark:hover:border-red-800/50'
                }
            `}
            onClick={() => variosCargos ? setMenuAberto(true) : aoClickCard(dados)}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/5 via-transparent to-red-600/5 pointer-events-none ${estaSelecionado ? 'opacity-100' : ''}`} />

            {/* IMAGEM */}
            <div className={`
                relative h-24 sm:h-28 md:h-32 flex items-center justify-center p-4
                overflow-hidden transition-all duration-300 shrink-0
                ${estaSelecionado
                    ? 'bg-gradient-to-br from-red-100/80 to-red-50/40 dark:from-red-900/30 dark:to-red-950/20'
                    : 'bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800/50 dark:to-zinc-900/30 group-hover:from-red-50 dark:group-hover:from-red-950/10'
                }
            `}>
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-red-600/5 rounded-full blur-2xl" />

                {editalBase.logoUrl || editalBase.logo ? (
                    <motion.img
                        whileHover={{ scale: 1.1, rotate: 2 }}
                        src={editalBase.logoUrl || editalBase.logo}
                        alt={tituloExibicao}
                        draggable="false"
                        className="h-full w-full object-contain z-10 drop-shadow-2xl transition-all duration-500 group-hover:drop-shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
                    />
                ) : (
                    <motion.div whileHover={{ scale: 1.1 }} className="w-14 h-14 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center shadow-xl z-10 border-2 border-zinc-200 dark:border-zinc-700">
                        <Library size={24} className="text-zinc-400" />
                    </motion.div>
                )}

                <AnimatePresence>
                    {estaSelecionado && (
                        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 180 }} className="absolute top-2 left-2 z-20 bg-gradient-to-br from-red-600 to-red-700 text-white p-1 rounded-full shadow-lg shadow-red-500/50 border-2 border-white dark:border-zinc-900">
                            <CheckCircle2 size={13} strokeWidth={3} />
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* CONTEÚDO */}
            <div className="relative p-3 flex flex-col flex-1 justify-between bg-white dark:bg-zinc-900">
                <div>
                    <h4 className={`font-bold text-xls leading-tight mb-2 line-clamp-2 transition-colors duration-300 ${estaSelecionado ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400'}`}>
                        {tituloExibicao}
                    </h4>

                    {/* Banca */}
                    <div className="mb-2 flex items-start gap-1 flex-wrap">
                        <span className="text-[9px] font-medium text-zinc-400 mt-0.5 shrink-0">Banca:</span>
                        <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 leading-tight break-all">
                            {editalBase.banca || 'A Definir'}
                        </span>
                    </div>

                    {estaSelecionado && variosCargos && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[9px] font-bold uppercase mb-1.5 border border-red-100 dark:border-red-900/30 w-full">
                            <Briefcase size={9} />
                            <span className="truncate flex-1">{itemSelecionadoDoGrupo.cargo || 'Cargo Selecionado'}</span>
                        </div>
                    )}
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">

                    {(unico || (variosCargos && estaSelecionado)) && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                            <div className={`p-1 rounded-md ${estaSelecionado ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'} transition-colors`}>
                                <Layers size={11} strokeWidth={2.5} />
                            </div>
                            <span>{qtdDisciplinas} Disciplinas</span>
                        </div>
                    )}

                    {variosCargos && estaSelecionado ? (
                        <div className="flex items-center gap-1.5 w-full">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmarGrupo}
                                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-[10px] font-bold px-2 py-2 rounded-lg shadow-lg shadow-red-500/40 border border-red-500 flex items-center justify-center gap-1 transition-all relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity duration-500" />
                                <span className="relative z-10 flex items-center gap-1">Confirmar <ArrowRight size={11} /></span>
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); setMenuAberto(true); }}
                                className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all"
                                title="Trocar Cargo"
                            >
                                <RefreshCw size={13} />
                            </motion.button>
                        </div>
                    ) : (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAction}
                            className={`text-[10px] font-bold px-3 py-2 rounded-lg transition-all duration-300 shadow-lg flex items-center justify-center gap-1.5 w-full relative overflow-hidden group/btn
                                ${estaSelecionado
                                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-red-500/40 border border-red-500'
                                    : 'bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-700 dark:to-zinc-800 text-white hover:from-red-600 hover:to-red-700 border border-zinc-700 dark:border-zinc-600'
                                }
                            `}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity duration-500" />
                            <span className="relative z-10 flex items-center gap-1">
                                {variosCargos
                                    ? (<>Cargos <ChevronDown size={11} className={`transition-transform duration-300 ${menuAberto ? 'rotate-180' : ''}`} /></>)
                                    : (<>{estaSelecionado ? 'Confirmar' : 'Selecionar'}</>)
                                }
                            </span>
                            {estaSelecionado && !variosCargos && <ArrowRight size={11} className="relative z-10 group-hover/btn:translate-x-1 transition-transform" />}
                        </motion.button>
                    )}
                </div>
            </div>

            {/* MENU OVERLAY DE CARGOS */}
            <AnimatePresence>
                {variosCargos && menuAberto && (
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute inset-0 z-30 bg-white dark:bg-zinc-950 flex flex-col"
                    >
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                                <Briefcase size={12} /> Cargos
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setMenuAberto(false); }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-lg transition-colors">
                                <X size={13} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar bg-zinc-50/30 dark:bg-black/20">
                            {dados.map((item) => {
                                const isItemActive = idSelecionado === item.id;
                                return (
                                    <button key={item.id} onClick={(e) => selecionarSubItem(e, item)}
                                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between group/item relative overflow-hidden
                                            ${isItemActive
                                                ? 'bg-white dark:bg-zinc-900 border-red-500 shadow-md ring-1 ring-red-500/20'
                                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        {isItemActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></div>}
                                        <div className="flex flex-col pl-1.5 min-w-0 flex-1">
                                            <span className={`text-[10px] font-bold uppercase truncate ${isItemActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400 group-hover/item:text-zinc-900 dark:group-hover/item:text-zinc-200'}`}>
                                                {item.cargo || 'Cargo Padrão'}
                                            </span>
                                            <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                                                <Layers size={8} /> {item.disciplinas?.length || 0} Disciplinas
                                                {item.ativo === false && <span className="text-red-500 ml-1">(Arq.)</span>}
                                            </span>
                                        </div>
                                        {isItemActive ? (
                                            <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white shadow-sm shadow-red-500/30 shrink-0 ml-1">
                                                <CheckCircle2 size={11} />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-zinc-200 dark:border-zinc-700 group-hover/item:border-red-400 transition-colors bg-zinc-50 dark:bg-zinc-800 shrink-0 ml-1" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const SecaoModelo = ({ chaveCategoria, itens, idSelecionado, aoDestacar, aoConfirmar, aoClickCard, config }) => {
    const defaultConfig = CATEGORIA_CONFIG[chaveCategoria] || CATEGORIA_CONFIG['adm'];
    const Icone = config?.icon || defaultConfig.icon;
    const bgClass = config?.bg || defaultConfig.bg;
    const colorClass = config?.color || defaultConfig.color;
    const label = config?.label || defaultConfig.label;

    const carrosselRef = useRef();
    const contentRef = useRef();
    const [largura, setLargura] = useState(0);
    const [arrastando, setArrastando] = useState(false);

    const gruposDeEditais = useMemo(() => {
        const grupos = {};
        itens.forEach(item => {
            let chave = item.instituicao || item.titulo.split(' - ')[0].trim();
            if (chaveCategoria === 'gcm' && item.titulo.includes('GCM')) {
                const parts = item.titulo.split(' - ');
                if (parts.length > 0) chave = parts[0];
            }
            chave = chave.toUpperCase();
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(item);
        });
        return Object.values(grupos);
    }, [itens, chaveCategoria]);

    useEffect(() => {
        const calcularLargura = () => {
            if (carrosselRef.current && contentRef.current) {
                const scrollW = contentRef.current.scrollWidth;
                const offsetW = carrosselRef.current.offsetWidth;
                setLargura(Math.max(0, scrollW - offsetW));
            }
        };

        calcularLargura();
        const timeout = setTimeout(calcularLargura, 300);

        window.addEventListener('resize', calcularLargura);
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', calcularLargura);
        };
    }, [gruposDeEditais]);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 last:mb-0">
            <div className="flex items-center gap-3 mb-3 px-1 sticky left-0 z-10">
                <motion.div whileHover={{ scale: 1.05 }} className={`relative p-2 rounded-xl ${bgClass} ${colorClass} shadow-md shadow-black/5 border-2 border-white/50 dark:border-white/5`}>
                    <Icone size={17} strokeWidth={2} />
                </motion.div>
                <div className="flex-1">
                    <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none mb-1">
                        {label}
                    </h4>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1 w-12 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                        <div className="h-1 w-2 bg-red-400 rounded-full opacity-60"></div>
                        <div className="h-1 w-1 bg-red-300 rounded-full opacity-40"></div>
                    </div>
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="px-2.5 py-1 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 text-white font-black text-[11px] shadow-lg border border-zinc-700/50">
                    {itens.length}
                </motion.div>
            </div>

            {/* CONTAINER DO ARRASTO (Máscara) */}
            <motion.div ref={carrosselRef} className="cursor-grab active:cursor-grabbing overflow-hidden -mx-3 px-3 py-2" whileTap={{ cursor: "grabbing" }}>

                {/* CONTEÚDO ARRASTÁVEL */}
                <motion.div
                    ref={contentRef}
                    drag="x"
                    dragConstraints={{ right: 0, left: -largura }}
                    dragElastic={0.06}
                    dragMomentum={false}
                    onDragStart={() => setArrastando(true)}
                    onDragEnd={() => setTimeout(() => setArrastando(false), 150)}
                    className="flex gap-3 sm:gap-4 w-max pb-3 transform-gpu will-change-transform"
                >
                    {gruposDeEditais.map((grupo, index) => (
                        <div key={index} className="relative transform transition-transform hover:z-10" onClickCapture={(e) => { if(arrastando) e.stopPropagation() }}>
                            <CardEdital dados={grupo.length === 1 ? grupo[0] : grupo} unico={grupo.length === 1} idSelecionado={idSelecionado} aoDestacar={aoDestacar} aoConfirmar={aoConfirmar} aoClickCard={aoClickCard} />
                        </div>
                    ))}
                </motion.div>

            </motion.div>
        </motion.div>
    );
};

// ==================================================================================
// MODAL PRINCIPAL
// ==================================================================================

const ModalSelecaoEdital = ({ aberto, aoFechar, aoSelecionar, modelos, carregando, configCategorias, modoPagina = false }) => {
    const [idSelecionadoLocal, setIdSelecionadoLocal] = useState(null);
    const [termoBusca, setTermoBusca] = useState('');

    useBodyScrollLock(!modoPagina && aberto, { overscrollBehavior: 'none' });

    const modelosCategorizados = useMemo(() => {
        const grupos = { pm: [], pc: [], pp: [], cbm: [], gcm: [], fa: [], federal: [], adm: [] };
        if (!modelos) return grupos;

        const modelosFiltrados = modelos.filter(m => {
            if (m.ativo === false) return false;
            if (!termoBusca) return true;
            const busca = termoBusca.toLowerCase();
            const textoBusca = (m.titulo + ' ' + (m.instituicao || '') + ' ' + (m.banca || '') + ' ' + (m.cargo || '')).toLowerCase();
            return textoBusca.includes(busca);
        });

        modelosFiltrados.forEach(m => {
            const textoBusca = (m.titulo + ' ' + (m.instituicao || '') + ' ' + (m.tipo || '')).toLowerCase();

            if (textoBusca.includes('federal') || textoBusca.includes('prf') || textoBusca.includes('pf') || textoBusca.includes('depen')) grupos.federal.push(m);
            else if (textoBusca.includes('pp') || textoBusca.includes('policia penal') || textoBusca.includes('penal') || textoBusca.includes('agepen')) grupos.pp.push(m);
            else if (textoBusca.includes('pm') || textoBusca.includes('policia militar') || textoBusca.includes('polícia militar')) grupos.pm.push(m);
            else if (textoBusca.includes('pc') || textoBusca.includes('policia civil') || textoBusca.includes('polícia civil')) grupos.pc.push(m);
            else if (textoBusca.includes('cbm') || textoBusca.includes('bombeiro')) grupos.cbm.push(m);
            else if (textoBusca.includes('gcm') || textoBusca.includes('guarda') || textoBusca.includes('cgm')) grupos.gcm.push(m);
            else if (textoBusca.includes('exército') || textoBusca.includes('marinha') || textoBusca.includes('aeronáutica') || textoBusca.includes('forças armadas') || textoBusca.includes('esa') || textoBusca.includes('eear') || textoBusca.includes('espcex') || textoBusca.includes('fuzileiro') || textoBusca.includes('aprendiz') || textoBusca.includes('sargento')) grupos.fa.push(m);
            else grupos.adm.push(m);
        });
        return grupos;
    }, [modelos, termoBusca]);

    const totalModelos = useMemo(() => Object.values(modelosCategorizados).reduce((acc, arr) => acc + arr.length, 0), [modelosCategorizados]);

    const lidarComDestaque = (modelo) => setIdSelecionadoLocal(prev => prev === modelo.id ? null : modelo.id);
    const lidarComClickCard = (modelo) => setIdSelecionadoLocal(prev => prev === modelo.id ? null : modelo.id);

    if (!aberto) return null;

    const conteudo = (
        <>
            <style>{`
                .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #ef4444 transparent; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#ef4444,#991b1b); border-radius:10px; }
            `}</style>

            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 24 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                onClick={(e) => !modoPagina && e.stopPropagation()}
                className={`
                    bg-white dark:bg-zinc-950
                    rounded-3xl border-2 border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl
                    flex flex-col overflow-hidden relative
                    ${modoPagina
                        ? 'w-full max-w-5xl min-h-[70vh] max-h-[74vh]'
                        : `
                            ${MODAL_LAYOUT.mobile.width}
                            ${MODAL_LAYOUT.mobile.maxHeight}
                            ${MODAL_LAYOUT.mobile.marginTop}
                            ${MODAL_LAYOUT.mobile.marginBottom}
                            ${MODAL_LAYOUT.desktop.maxWidth}
                            ${MODAL_LAYOUT.desktop.maxHeight}
                            ${MODAL_LAYOUT.desktop.marginTop}
                            ${MODAL_LAYOUT.desktop.marginBottom}
                            ${MODAL_LAYOUT.desktop.marginLeft}
                          `
                    }
                `}
            >
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />

                        {/* HEADER */}
                        <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur rounded-t-3xl z-20">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20 shrink-0">
                                    <Library size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white uppercase leading-none">
                                        Catálogo de Editais
                                    </h2>
                                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide hidden sm:block">
                                        Selecione seu edital
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="relative group hidden sm:flex items-center">
                                    <input type="text" placeholder="Buscar edital..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-2 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-red-500 focus:outline-none transition-colors shadow-inner w-40 md:w-52" />
                                    {termoBusca && <button onClick={() => setTermoBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500 transition-colors"><X size={12} /></button>}
                                </div>
                                <div className="hidden sm:flex px-2.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black text-xs shadow-lg items-center gap-1.5 shrink-0"><Layers size={13} /> {totalModelos}</div>
                                {!modoPagina && (
                                    <button onClick={aoFechar} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20} /></button>
                                )}
                            </div>
                        </div>

                        {/* Busca mobile */}
                        <div className="flex sm:hidden px-4 pt-3 pb-0 shrink-0">
                            <div className="relative w-full group">
                                <input type="text" placeholder="Buscar edital, banca, cargo..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-2 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-red-500 focus:outline-none transition-colors shadow-inner" />
                                {termoBusca && <button onClick={() => setTermoBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500 transition-colors"><X size={13} /></button>}
                            </div>
                        </div>

                        {/* CONTEÚDO */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-[#0a0a0a] dark:via-[#0f0f0f] dark:to-[#0a0a0a] custom-scrollbar scroll-smooth pb-20">
                            {carregando ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full gap-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full border-4 border-zinc-100 dark:border-zinc-800"></div>
                                        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                                        <Library className="absolute inset-0 m-auto text-zinc-300 dark:text-zinc-700 opacity-50" size={24} />
                                    </div>
                                    <span className="text-zinc-400 text-xs font-black uppercase tracking-[0.2em] animate-pulse">Carregando catálogo...</span>
                                </motion.div>
                            ) : (
                                <div className="space-y-5 pb-16">
                                    {Object.keys(modelosCategorizados).map(chave => (
                                        modelosCategorizados[chave].length > 0 && (
                                            <SecaoModelo key={chave} chaveCategoria={chave} itens={modelosCategorizados[chave]} idSelecionado={idSelecionadoLocal} aoDestacar={lidarComDestaque} aoConfirmar={aoSelecionar} aoClickCard={lidarComClickCard} config={configCategorias?.[chave]} />
                                        )
                                    ))}
                                    {totalModelos === 0 && (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4"><Filter className="w-8 h-8 text-zinc-300" /></div>
                                            <h3 className="text-base font-black text-zinc-400 uppercase tracking-tight">Nenhum edital encontrado</h3>
                                            <p className="text-zinc-400 mt-1 text-sm font-medium">Tente ajustar seus termos de busca</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent pointer-events-none z-10" />
            </motion.div>
        </>
    );

    if (modoPagina) {
        return <div className="w-full">{conteudo}</div>;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={`fixed inset-0 ${MODAL_LAYOUT.zIndex} flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-hidden touch-none`}
                onClick={aoFechar}
            >
                {conteudo}
            </motion.div>
        </AnimatePresence>
    );
};

export default ModalSelecaoEdital;
