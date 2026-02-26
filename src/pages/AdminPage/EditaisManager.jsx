import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../firebaseConfig';
import { collection, doc, deleteDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ShieldAlert, BadgeAlert, Lock, Flame, Siren, LayoutGrid,
  CheckCircle2, Trash2, X, Server, Globe, Search, Plus, Save,
  Image as ImageIcon, Edit, AlertCircle, Check, Eye, EyeOff,
  Link, Copy, Layers, Target, Briefcase
} from 'lucide-react';

// ==================================================================================
// 🔔 TOAST
// ==================================================================================
const ToastNotification = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isSuccess = type === 'success';
    return (
        <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/10 ${
                isSuccess ? 'bg-emerald-500/90 text-white shadow-emerald-500/20' : 'bg-red-500/90 text-white shadow-red-500/20'
            }`}
        >
            <div className={`p-1 rounded-full ${isSuccess ? 'bg-emerald-600' : 'bg-red-600'}`}>
                {isSuccess ? <Check size={16} strokeWidth={3}/> : <AlertCircle size={16} strokeWidth={3}/>}
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-wide">{isSuccess ? 'Sucesso' : 'Erro'}</span>
                <span className="text-xs font-medium opacity-90">{message}</span>
            </div>
            <button onClick={onClose} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={14} />
            </button>
        </motion.div>
    );
};

// ==================================================================================
// 🚀 DADOS & CONFIG
// ==================================================================================
let seedModules = {};
try {
    seedModules = import.meta.glob('../../components/admin/SeedEdital*.jsx', { eager: true });
} catch (e) {
    console.warn('Nenhum módulo SeedEdital encontrado:', e);
}

export const CATALOGO_EDITAIS = Object.entries(seedModules)
  .map(([path, module]) => {
    const Component = module.default;
    if (!Component) return null;
    const config = module.editalConfig || {};
    const fileName = path.split('/').pop().replace('.jsx', '');
    const siglaBruta = fileName.replace('SeedEdital', '');
    const siglaLower = siglaBruta.toLowerCase();
    const idFinal = config.id || siglaLower;
    let tipoFinal = config.tipo;

    if (!tipoFinal) {
      if (idFinal.includes('pf') || idFinal.includes('prf') || idFinal.includes('depen')) tipoFinal = 'federal';
      else if (idFinal.includes('esa') || idFinal.includes('eear') || idFinal.includes('espcex')) tipoFinal = 'fa';
      else if (idFinal.includes('pm')) tipoFinal = 'pm';
      else if (idFinal.includes('pc')) tipoFinal = 'pc';
      else if (idFinal.includes('pp')) tipoFinal = 'pp';
      else if (idFinal.includes('cbm') || idFinal.includes('bm')) tipoFinal = 'cbm';
      else if (idFinal.includes('gcm') || idFinal.includes('gm')) tipoFinal = 'gcm';
      else tipoFinal = 'adm';
    }
    return {
      id: idFinal,
      titulo: config.titulo || `Edital ${siglaBruta}`,
      banca: config.banca || 'A Definir',
      logo: config.logo || `/logosEditais/logo-${siglaLower}.png`,
      SeedComponent: Component,
      type: tipoFinal,
      cargo: config.cargo || '',
      isLocal: true,
      ativo: true
    };
  })
  .filter(Boolean);

const LOCAL_TEMPLATES = CATALOGO_EDITAIS;

const ESTADOS_BRASIL = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const CATEGORIAS_EDITAL = [
    { id: 'fa',      label: 'Forças Armadas',           icon: Target,     color: 'text-green-600' },
    { id: 'gcm',     label: 'Guarda Municipal (GCM)',   icon: Siren,      color: 'text-blue-400'  },
    { id: 'pm',      label: 'Polícia Militar (PM)',     icon: ShieldAlert,color: 'text-zinc-700'  },
    { id: 'pc',      label: 'Polícia Civil (PC)',       icon: BadgeAlert, color: 'text-zinc-700'  },
    { id: 'pp',      label: 'Polícia Penal (PP)',       icon: Lock,       color: 'text-zinc-700'  },
    { id: 'cbm',     label: 'Bombeiros (CBM)',          icon: Flame,      color: 'text-red-500'   },
    { id: 'federal', label: 'Carreiras Federais',       icon: Globe,      color: 'text-blue-500'  },
    { id: 'adm',     label: 'Administrativo',           icon: Briefcase,  color: 'text-emerald-500' },
];

const CARGOS_POR_TIPO = {
    fa:      ['Soldado', 'Fuzileiro Naval', 'Marinheiro', 'Sargento', 'Oficial', 'Cadete', 'Aprendiz', 'Tenente'],
    pm:      ['Soldado','Oficial','Cabo','Sargento','Aluno a Oficial','Músico','Saúde'],
    pc:      ['Investigador','Escrivão','Delegado','Perito Criminal','Médico Legista','Agente','Papiloscopista'],
    pp:      ['Policial Penal','Agente Penitenciário','Assistente Adm.'],
    cbm:     ['Soldado','Oficial','Condutor'],
    federal: ['Agente','Escrivão','Delegado','Policial Rodoviário','Agente Administrativo'],
    gcm:     ['Guarda Municipal','Inspetor','Subinspetor'],
    adm:     [
        'Assistente Administrativo', 'Analista Administrativo', 'Técnico Administrativo',
        'Auxiliar Administrativo', 'Recepcionista', 'Secretário(a)', 'Contador',
        'Gestor de RH', 'Analista Financeiro', 'Auxiliar de Escritório', 'Auditor',
        'Técnico Judiciário', 'Analista Judiciário', 'Professor', 'Merendeira'
    ]
};

const getPrefixoInstituicao = (tipo, estado, cidade) => {
    if (tipo === 'gcm' && cidade)                        return `GCM ${cidade}`.toUpperCase();
    if (['pm','pc','pp','cbm'].includes(tipo) && estado) return `${tipo.toUpperCase()}${estado.toUpperCase()}`;
    if (tipo === 'federal')                              return 'CONCURSO FEDERAL';
    if (tipo === 'fa')                                   return 'FORÇAS ARMADAS';
    return null;
};

// ==================================================================================
// 🛠️ MODAL DE CRIAÇÃO/EDIÇÃO
// ==================================================================================
const CustomEditalModal = ({ onClose, editalToEdit, showToast, allEditais }) => {
    const isEditing = !!editalToEdit;

    const [formData, setFormData] = useState({
        cidade:      '',
        estado:      'BA',
        titulo:      '',
        banca:       '',
        tipo:        'gcm',
        logoFile:    null,
        logoPreview: null,
    });

    const [cargos, setCargos]                   = useState([{ id: 1, nome: '', json: '' }]);
    const [activeCargoIndex, setActiveCargoIndex] = useState(0);
    const [isCustomCargo, setIsCustomCargo]     = useState(false);
    const [irmao, setIrmao]                     = useState(null);
    const [manualOverride, setManualOverride]   = useState({ banca: false, logo: false });
    const [loading, setLoading]                 = useState(false);
    const [showSidebar, setShowSidebar]         = useState(false);

    const fileInputRef = React.useRef(null);

    useEffect(() => {
        if (isEditing) {
            setFormData({
                cidade:      '',
                estado:      'BA',
                titulo:      editalToEdit.titulo,
                banca:       editalToEdit.banca,
                tipo:        editalToEdit.tipo || 'adm',
                logoFile:    null,
                logoPreview: editalToEdit.logoUrl || editalToEdit.logo,
            });
            setCargos([{
                id: 1,
                nome: editalToEdit.cargo || '',
                json: JSON.stringify(editalToEdit.disciplinas || [], null, 2)
            }]);
            const cargosPadrao = CARGOS_POR_TIPO[editalToEdit.tipo || 'adm'] || [];
            if (editalToEdit.cargo && !cargosPadrao.includes(editalToEdit.cargo)) {
                setIsCustomCargo(true);
            }
        }
    }, [isEditing, editalToEdit]);

    useEffect(() => {
        if (isEditing) return;
        const tipoUpper = formData.tipo.toUpperCase();
        let tituloBase = '';
        if (formData.tipo === 'gcm' && formData.cidade)               tituloBase = `GCM ${formData.cidade} - ${formData.estado}`;
        else if (['pm','pc','pp','cbm'].includes(formData.tipo))       tituloBase = `${tipoUpper}${formData.estado}`;
        else if (formData.tipo === 'federal')                          tituloBase = `Concurso Federal`;
        else if (formData.tipo === 'fa')                               tituloBase = `Concurso Forças Armadas`;

        const cargoAtual = cargos[activeCargoIndex]?.nome;
        let tituloFinal = tituloBase;
        if (cargos.length === 1 && cargoAtual && tituloBase && !tituloBase.includes(cargoAtual)) {
            tituloFinal = `${tituloBase} - ${cargoAtual}`;
        }

        const prefixo = getPrefixoInstituicao(formData.tipo, formData.estado, formData.cidade);
        let encontrado = null;
        if (prefixo && allEditais?.length) {
            encontrado = allEditais.find(e => {
                const tituloNorm = (e.titulo || '').toUpperCase();
                const instNorm   = (e.instituicao || '').toUpperCase();
                return tituloNorm.startsWith(prefixo) || instNorm.startsWith(prefixo);
            }) || null;
        }

        setIrmao(encontrado);
        setFormData(prev => {
            const next = { ...prev };
            if (tituloFinal) next.titulo = tituloFinal;
            if (encontrado && !manualOverride.banca)                          next.banca = encontrado.banca || prev.banca;
            if (encontrado && !manualOverride.logo && !prev.logoFile)         next.logoPreview = encontrado.logoUrl || encontrado.logo || prev.logoPreview;
            return next;
        });

        if (formData.tipo === 'adm' && !isEditing) setShowSidebar(true);
        else if (formData.tipo !== 'adm' && !isEditing) setShowSidebar(false);
    }, [formData.cidade, formData.estado, formData.tipo, cargos, activeCargoIndex, isEditing, allEditais]);

    const handleAddCargo = () => {
        setCargos(prev => [...prev, { id: Date.now(), nome: '', json: '' }]);
        setActiveCargoIndex(cargos.length);
    };

    const handleRemoveCargo = (index, e) => {
        e.stopPropagation();
        if (cargos.length === 1) return;
        const novos = cargos.filter((_, i) => i !== index);
        setCargos(novos);
        setActiveCargoIndex(0);
    };

    const updateCargo = (field, value) => {
        const novos = [...cargos];
        novos[activeCargoIndex][field] = value;
        setCargos(novos);
    };

    const handleUseTemplate = (template) => {
        setFormData(prev => ({
            ...prev,
            banca:       template.banca,
            logoPreview: template.logoUrl || template.logo,
            titulo:      template.titulo
        }));
        setManualOverride({ banca: true, logo: true });
        updateCargo('json', JSON.stringify(template.disciplinas || [], null, 2));
        showToast(`Dados de "${template.titulo}" copiados!`, "success");
    };

    const handleSave = async () => {
        if (!formData.titulo) return showToast("Preencha o título.", "error");
        for (let i = 0; i < cargos.length; i++) {
            if (!cargos[i].nome)  return showToast(`O cargo ${i+1} precisa de um nome.`, "error");
            if (!cargos[i].json) return showToast(`O cargo ${cargos[i].nome} precisa de disciplinas.`, "error");
            try {
                const parsed = JSON.parse(cargos[i].json);
                if (!Array.isArray(parsed)) throw new Error();
            } catch {
                return showToast(`Erro no JSON do cargo ${cargos[i].nome}.`, "error");
            }
        }

        setLoading(true);
        try {
            let finalLogoUrl = formData.logoPreview;
            if (formData.logoFile) {
                const cleanType  = formData.tipo.toLowerCase();
                const cleanLoc   = formData.tipo === 'gcm' ? formData.cidade.toLowerCase() : formData.estado.toLowerCase();
                const storageRef = ref(storage, `editais_logos/${cleanType}_${cleanLoc}_${Date.now()}`);
                const snapshot   = await uploadBytes(storageRef, formData.logoFile);
                finalLogoUrl     = await getDownloadURL(snapshot.ref);
            } else if (!finalLogoUrl) {
                if (formData.tipo === 'pm')       finalLogoUrl = '/logosEditais/logo-pm.png';
                else if (formData.tipo === 'pc')  finalLogoUrl = '/logosEditais/logo-pc.png';
                else if (formData.tipo === 'cbm') finalLogoUrl = '/logosEditais/logo-cbm.png';
                else if (formData.tipo === 'fa')  finalLogoUrl = '/logosEditais/logo-fa.png';
                else finalLogoUrl = '/logosEditais/logo-gcm-padrao.png';
            }

            const promises = cargos.map(async (cargo) => {
                const disciplinasParsed = JSON.parse(cargo.json);
                let docId;
                if (isEditing && cargos.length === 1) {
                    docId = editalToEdit.id;
                } else {
                    const cleanType  = formData.tipo.toLowerCase();
                    const cleanCargo = cargo.nome.toLowerCase().replace(/\s+/g, '');
                    const cleanLoc   = formData.tipo === 'gcm'
                        ? (formData.cidade ? formData.cidade.toLowerCase() : 'geral')
                        : formData.estado.toLowerCase();
                    docId = `${cleanType}_${cleanLoc}_${cleanCargo}_${Math.floor(Math.random() * 10000)}`;
                }

                let tituloFinal = formData.titulo;
                if (cargos.length > 1 && !tituloFinal.toLowerCase().includes(cargo.nome.toLowerCase())) {
                    tituloFinal = `${tituloFinal} - ${cargo.nome}`;
                }

                const payload = {
                    titulo:      tituloFinal,
                    banca:       formData.banca || 'A Definir',
                    logoUrl:     finalLogoUrl,
                    logo:        finalLogoUrl,
                    instituicao: formData.titulo.split(' - ')[0] || formData.tipo.toUpperCase(),
                    tipo:        formData.tipo,
                    cargo:       cargo.nome,
                    disciplinas: disciplinasParsed,
                    isCustom:    true,
                    ativo:       true,
                    // ✅ CRÍTICO: lastUpdate SEMPRE atualizado para disparar alertas nos usuários
                    lastUpdate:  serverTimestamp(),
                };

                // ✅ FIX: usa setDoc com merge para TODOS os casos (criar E editar)
                // Isso garante que o documento é criado se não existir (importante para seeds)
                await setDoc(doc(db, "editais_templates", docId), payload, { merge: true });
            });

            await Promise.all(promises);
            showToast(`${cargos.length} edital(is) salvo(s) com sucesso!`, "success");
            onClose();
        } catch (error) {
            console.error(error);
            showToast("Erro: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const cargosDisponiveis = CARGOS_POR_TIPO[formData.tipo] || [];
    const editaisLaterais   = allEditais.filter(e => e.type === formData.tipo);
    const temIrmao          = !!irmao && !isEditing;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pt-20">
            <div className={`
                bg-white dark:bg-zinc-950 w-full rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex overflow-hidden transition-all duration-500
                ${showSidebar ? 'max-w-6xl' : 'max-w-3xl'}
                h-[85vh] sm:h-[80vh]
            `}>
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/20">
                                {isEditing ? <Edit size={20} /> : <Plus size={20} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                    {isEditing ? 'Editar Edital' : 'Novo Edital'}
                                </h3>
                                <p className="text-[10px] font-bold text-zinc-400">Configure os detalhes</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`p-2 rounded-lg border transition-all ${showSidebar ? 'bg-red-50 border-red-200 text-red-600' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}
                            title="Ver modelos existentes"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo</label>
                                <select
                                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none transition-all cursor-pointer"
                                    value={formData.tipo}
                                    onChange={e => {
                                        setIrmao(null);
                                        setManualOverride({ banca: false, logo: false });
                                        setFormData(prev => ({ ...prev, tipo: e.target.value }));
                                        setIsCustomCargo(false);
                                        if (e.target.value === 'adm') setShowSidebar(true);
                                    }}
                                >
                                    {CATEGORIAS_EDITAL.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                </select>
                            </div>
                            {!isEditing && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Estado / Local</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="w-20 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                            value={formData.estado}
                                            onChange={e => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                                        >
                                            {ESTADOS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                        </select>
                                        {formData.tipo === 'gcm' && (
                                            <input
                                                className="flex-1 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                                value={formData.cidade}
                                                onChange={e => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                                                placeholder="Cidade"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Título do Concurso</label>
                                <input
                                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                    value={formData.titulo}
                                    onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                                    placeholder="Ex: PMBA 2026"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Banca</label>
                                <div className="relative">
                                    <input
                                        className={`w-full p-2.5 rounded-xl text-xs font-bold border ${temIrmao && !manualOverride.banca ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                                        value={formData.banca}
                                        onChange={(e) => { setManualOverride(p => ({...p, banca: true})); setFormData(p => ({...p, banca: e.target.value})); }}
                                        placeholder="Definir Banca"
                                    />
                                    {temIrmao && !manualOverride.banca && <Link size={12} className="absolute right-3 top-3 text-emerald-500" />}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-12 h-12 rounded-xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors relative overflow-hidden"
                            >
                                {formData.logoPreview ? (
                                    <img src={formData.logoPreview} className="w-full h-full object-contain p-1" alt="" />
                                ) : (
                                    <ImageIcon size={20} className="text-zinc-300" />
                                )}
                                <input type="file" ref={fileInputRef} onChange={e => {
                                    const f = e.target.files[0];
                                    if (f) {
                                        setManualOverride(p => ({...p, logo: true}));
                                        setFormData(p => ({...p, logoFile: f, logoPreview: URL.createObjectURL(f)}));
                                    }
                                }} className="hidden" accept="image/*" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Logotipo da Instituição</p>
                                <p className="text-[10px] text-zinc-400">Clique na imagem para alterar</p>
                            </div>
                            {formData.logoPreview && (
                                <button onClick={() => setFormData(p => ({...p, logoPreview: null, logoFile: null}))}>
                                    <X size={16} className="text-zinc-400 hover:text-red-500" />
                                </button>
                            )}
                        </div>

                        <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full my-2"></div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers size={12} className="text-red-500"/> Cargos & Disciplinas
                                </label>
                                <button onClick={handleAddCargo} className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1">
                                    <Plus size={10} /> Adicionar Cargo
                                </button>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
                                {cargos.map((c, idx) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setActiveCargoIndex(idx)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border
                                            ${activeCargoIndex === idx
                                                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-white dark:text-zinc-900'
                                                : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                                            }`}
                                    >
                                        {c.nome || `Cargo ${idx + 1}`}
                                        {cargos.length > 1 && (
                                            <span onClick={(e) => handleRemoveCargo(idx, e)} className="hover:text-red-500 ml-1"><X size={10}/></span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome do Cargo</label>
                                    {cargosDisponiveis.length > 0 && !isCustomCargo ? (
                                        <select
                                            className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                            value={cargos[activeCargoIndex].nome}
                                            onChange={e => {
                                                if (e.target.value === 'Outro') { setIsCustomCargo(true); updateCargo('nome', ''); }
                                                else updateCargo('nome', e.target.value);
                                            }}
                                        >
                                            <option value="">Selecione...</option>
                                            {cargosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                                            <option value="Outro">Outro (Digitar)</option>
                                        </select>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
                                                placeholder="Ex: Soldado, Analista..."
                                                value={cargos[activeCargoIndex].nome}
                                                onChange={e => updateCargo('nome', e.target.value)}
                                            />
                                            {cargosDisponiveis.length > 0 && (
                                                <button onClick={() => setIsCustomCargo(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"><X size={14}/></button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Disciplinas (JSON)</label>
                                        <a href="#" className="text-[9px] text-blue-500 hover:underline">Ver modelo</a>
                                    </div>
                                    <textarea
                                        className="w-full h-32 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono text-[10px] leading-relaxed resize-none focus:ring-1 focus:ring-red-500 outline-none custom-scrollbar"
                                        value={cargos[activeCargoIndex].json}
                                        onChange={e => updateCargo('json', e.target.value)}
                                        placeholder={`[\n  { "nome": "Português", "assuntos": ["Crase"] }\n]`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-white dark:bg-zinc-950 rounded-b-3xl">
                        <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/20 flex items-center gap-2">
                            {loading ? 'Salvando...' : <><Save size={14}/> Salvar {cargos.length} Cargo(s)</>}
                        </button>
                    </div>
                </div>

                {showSidebar && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden"
                    >
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-xs font-black text-zinc-500 uppercase">Modelos Existentes</span>
                            <button onClick={() => setShowSidebar(false)}><X size={14} className="text-zinc-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {editaisLaterais.length > 0 ? editaisLaterais.map(template => (
                                <div key={template.id} className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-red-300 transition-all group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <img src={template.logoUrl || template.logo} className="w-8 h-8 object-contain opacity-80" alt="" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-zinc-800 dark:text-white truncate">{template.titulo}</p>
                                            <p className="text-[10px] text-zinc-500">{template.banca}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUseTemplate(template)}
                                        className="w-full py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <Copy size={10} /> Copiar Dados
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-10 text-zinc-400 text-xs">
                                    Nenhum modelo encontrado para esta categoria.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

// ==================================================================================
// 🖥️ COMPONENTE PRINCIPAL (MANAGER)
// ==================================================================================
const EditaisManagerModal = ({ isOpen, onClose }) => {
  const [dbTemplates, setDbTemplates]         = useState([]);
  const [activeTab, setActiveTab]             = useState('todos');
  const [searchTerm, setSearchTerm]           = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editalToEdit, setEditalToEdit]       = useState(null);
  const [toast, setToast]                     = useState(null);

  const triggerToast = (msg, type = 'success') => setToast({ message: msg, type });

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = 'unset';
    if (!isOpen) return;

    const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), isInstalled: true }));
      setDbTemplates(docs);
    });
    return () => unsub();
  }, [isOpen]);

  const allEditais = useMemo(() => {
    const dbMap = new Map(dbTemplates.map(t => [t.id, t]));

    const localWithOverrides = LOCAL_TEMPLATES
      .filter(loc => !dbMap.get(loc.id)?.deleted)
      .map(loc => {
        const dbVersion = dbMap.get(loc.id);
        if (dbVersion) {
          return {
            ...loc,
            ...dbVersion,
            logo:        dbVersion.logoUrl || dbVersion.logo || loc.logo,
            SeedComponent: loc.SeedComponent,
            isLocal:     true,
            isInstalled: true,
          };
        }
        return loc;
      });

    const customTemplates = dbTemplates
      .filter(dbT => !LOCAL_TEMPLATES.find(loc => loc.id === dbT.id) && !dbT.deleted)
      .map(t => ({
        ...t,
        logo:      t.logoUrl || t.logo,
        type:      t.tipo || 'adm',
        isCustom:  true,
        isInstalled: true,
        ativo:     t.ativo !== undefined ? t.ativo : true,
      }));

    return [...localWithOverrides, ...customTemplates];
  }, [dbTemplates]);

  if (!isOpen) return null;

  const categories = [
    { id: 'todos',   label: 'Todos',          icon: LayoutGrid, color: 'text-zinc-500'    },
    { id: 'fa',      label: 'Forças Armadas', icon: Target,     color: 'text-green-600'   },
    { id: 'federal', label: 'Federais',       icon: Globe,      color: 'text-blue-500'    },
    { id: 'pm',      label: 'Polícia Militar',icon: ShieldAlert,color: 'text-zinc-700'    },
    { id: 'pc',      label: 'Polícia Civil',  icon: BadgeAlert, color: 'text-zinc-700'    },
    { id: 'pp',      label: 'Polícia Penal',  icon: Lock,       color: 'text-zinc-700'    },
    { id: 'cbm',     label: 'Bombeiros',      icon: Flame,      color: 'text-red-500'     },
    { id: 'gcm',     label: 'Guarda Mun.',    icon: Siren,      color: 'text-blue-400'    },
    { id: 'adm',     label: 'Administrativo', icon: Briefcase,  color: 'text-emerald-500' },
  ];

  const filteredEditais = allEditais.filter(e => {
    const matchesTab    = activeTab === 'todos' || e.type === activeTab;
    const matchesSearch = (e.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.banca  || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleCreateNew = () => { setEditalToEdit(null); setShowCustomModal(true); };
  const handleEdit      = (edital) => { setEditalToEdit(edital); setShowCustomModal(true); };

  const EditalCard = ({ edital }) => {
    const SeedBtn  = edital.SeedComponent;
    const isCustom = edital.isCustom || edital.isCustomGCM;
    const isAtivo  = edital.ativo !== false;
    const isSeed   = edital.isLocal;

    const handleToggleStatus = async () => {
      try {
        const novoAtivo = !isAtivo;
        // ✅ setDoc com merge para não perder dados existentes
        await setDoc(
          doc(db, 'editais_templates', edital.id),
          { ativo: novoAtivo, lastUpdate: serverTimestamp() },
          { merge: true }
        );
        triggerToast(`Edital ${novoAtivo ? 'ativado' : 'arquivado'}!`, "success");
      } catch (e) {
        triggerToast("Erro ao alterar status: " + e.message, "error");
      }
    };

    const handleDelete = async () => {
      const isSeedConfirm = isSeed
        ? '\n\nATENÇÃO: Este é um edital do sistema (Seed). Ele será ocultado permanentemente, mas continuará no código-fonte.'
        : '';

      if (!window.confirm(`Deseja remover "${edital.titulo}"?${isSeedConfirm}`)) return;

      try {
        if (isCustom && !isSeed) {
          await deleteDoc(doc(db, 'editais_templates', edital.id));
        } else {
          await setDoc(
            doc(db, 'editais_templates', edital.id),
            { deleted: true, ativo: false, lastUpdate: serverTimestamp() },
            { merge: true }
          );
        }
        triggerToast("Edital removido!", "success");
      } catch (e) {
        triggerToast("Erro ao remover: " + e.message, "error");
      }
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-full overflow-hidden
          ${!isAtivo
              ? 'opacity-60 grayscale bg-zinc-100 dark:bg-zinc-900 border-dashed'
              : edital.isInstalled
                ? 'bg-white dark:bg-zinc-900 border-emerald-500/30 ring-1 ring-emerald-500/20'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/50'
          }`}
      >
        {edital.isInstalled && isAtivo && (
          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl z-20 shadow-sm">
            INSTALADO
          </div>
        )}
        {!isAtivo && (
          <div className="absolute top-0 right-0 bg-zinc-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl z-20 shadow-sm">
            ARQUIVADO
          </div>
        )}
        {isSeed && isAtivo && (
          <div className="absolute top-0 left-0 bg-indigo-500/80 text-white text-[8px] font-black px-2 py-0.5 rounded-br-lg z-20">
            SEED
          </div>
        )}

        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 shrink-0 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-center p-2 shadow-inner group-hover:scale-105 transition-transform duration-500">
            <img
              src={edital.logoUrl || edital.logo}
              className="w-full h-full object-contain drop-shadow-sm"
              alt="logo"
              onError={(e) => { e.target.src = '/vite.svg'; }}
            />
          </div>
          <div className="pt-1 overflow-hidden">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight mb-1 truncate pr-2 group-hover:text-red-600 transition-colors">
              {edital.titulo}
            </h4>
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md uppercase tracking-wide">
                {edital.banca}
              </span>
              {edital.cargo && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {edital.cargo}
                </span>
              )}
              {isCustom && !edital.cargo && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md uppercase tracking-wide">
                  Custom
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
          <div className="flex-1 min-w-0">
            {SeedBtn ? (
              <SeedBtn isInstalled={edital.isInstalled} />
            ) : (
              <button
                disabled={!isAtivo}
                className={`w-full px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800 cursor-default flex items-center justify-center gap-2 ${!isAtivo ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <CheckCircle2 size={14}/> {isAtivo ? 'Disponível' : 'Indisponível'}
              </button>
            )}
          </div>

          {/* ✅ FIX: Botão de editar aparece para TODOS os templates (seeds e custom) */}
          <button
            onClick={() => handleEdit(edital)}
            className="p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-sm"
            title={isSeed ? "Editar seed (salva override no Firestore)" : "Editar"}
          >
            <Edit size={16} />
          </button>

          <button
            onClick={handleToggleStatus}
            className="p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 hover:border-amber-200 rounded-xl transition-all shadow-sm"
            title={isAtivo ? "Arquivar" : "Reativar"}
          >
            {isAtivo ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>

          <button
            onClick={handleDelete}
            className="p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-xl transition-all shadow-sm"
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-sans">
      <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #ef4444 transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#ef4444,#991b1b); border-radius:10px; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
      `}</style>

      <AnimatePresence>
        {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomModal && (
          <CustomEditalModal
            onClose={() => setShowCustomModal(false)}
            editalToEdit={editalToEdit}
            showToast={triggerToast}
            allEditais={allEditais}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-zinc-50 dark:bg-zinc-950 w-full max-w-7xl max-h-[92vh] rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden ring-4 ring-zinc-200/50 dark:ring-zinc-900/50"
      >
        <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-center gap-6 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600 flex items-center justify-center border border-red-100 dark:border-red-800/30">
              <Server size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                Central de Editais
              </h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                Gerencie e instale novos concursos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg hover:shadow-red-600/30 transition-all hover:-translate-y-0.5 group"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform"/> Novo Edital
            </button>

            <div className="relative w-full md:w-72 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500 transition-colors" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar edital..."
                className="w-full pl-12 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>

            <button
              onClick={onClose}
              className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-500 hover:text-red-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/50 dark:bg-black/20">
          <div className="px-8 pt-6 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {categories.map(cat => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border uppercase tracking-wide
                      ${isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 shadow-lg shadow-zinc-900/20'
                        : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                  >
                    <cat.icon size={14} className={isActive ? '' : cat.color} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredEditais.map(edital => (
                  <EditalCard key={edital.id} edital={edital} />
                ))}
              </AnimatePresence>

              {filteredEditais.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-400">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <LayoutGrid size={40} className="opacity-20" />
                  </div>
                  <p className="font-bold text-lg">Nenhum edital encontrado.</p>
                  <p className="text-xs">Tente mudar a categoria ou criar um novo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EditaisManagerModal;