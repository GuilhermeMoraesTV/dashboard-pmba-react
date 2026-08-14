import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../firebaseConfig';
import { collection, doc, deleteDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ShieldAlert, BadgeAlert, Lock, Flame, Siren, LayoutGrid,
  CheckCircle2, Trash2, X, Server, Globe, Search, Plus, Save,
  Image as ImageIcon, Edit, AlertCircle, Check, Eye, EyeOff,
  Link, Copy, Layers, Target, Briefcase, Download, Sparkles, ChevronDown,
  Rocket, RefreshCw, AlertTriangle, Info
} from 'lucide-react';
import { gerarResumoAtualizacaoIA, gerarDescricaoDiff, deveNotificarAluno, formatarNomeEditalLegivel } from '../../services/editalIA';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import ConfirmModal from '../../components/shared/ConfirmModal';

// ==================================================================================
// 🔔 TOAST
// ==================================================================================
const ToastNotification = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const isSuccess = type === 'success';
  return (
    <motion.div initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -50, scale: 0.9 }}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/10 ${isSuccess ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
      <div className={`p-1 rounded-full ${isSuccess ? 'bg-emerald-600' : 'bg-red-600'}`}>
        {isSuccess ? <Check size={16} strokeWidth={3} /> : <AlertCircle size={16} strokeWidth={3} />}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-black uppercase tracking-wide">{isSuccess ? 'Sucesso' : 'Erro'}</span>
        <span className="text-xs font-medium opacity-90">{message}</span>
      </div>
      <button onClick={onClose} className="ml-4 p-1 hover:bg-white/20 rounded-full"><X size={14} /></button>
    </motion.div>
  );
};

// ==================================================================================
// 🚀 CARREGAMENTO DOS MÓDULOS SEED
// ==================================================================================
let seedModules = {};
try {
  seedModules = import.meta.glob('../../components/admin/SeedEdital*.jsx', { eager: true });
} catch (e) {
  console.warn('Nenhum módulo SeedEdital encontrado:', e);
}

// ==================================================================================
// 📋 CATÁLOGO DE EDITAIS
// ==================================================================================
export const CATALOGO_EDITAIS = Object.entries(seedModules)
  .map(([path, module]) => {
    const Component = module.default;
    if (!Component) return null;
    const config     = module.editalConfig || {};
    const fileName   = path.split('/').pop().replace('.jsx', '');
    const siglaBruta = fileName.replace('SeedEdital', '');
    const siglaLower = siglaBruta.toLowerCase();
    const idFinal    = config.id || siglaLower;
    let tipoFinal    = config.tipo;
    if (!tipoFinal) {
      if (idFinal.includes('pf') || idFinal.includes('prf') || idFinal.includes('depen')) tipoFinal = 'federal';
      else if (idFinal.includes('esa') || idFinal.includes('eear') || idFinal.includes('espcex')) tipoFinal = 'fa';
      else if (idFinal.includes('pm'))  tipoFinal = 'pm';
      else if (idFinal.includes('pc'))  tipoFinal = 'pc';
      else if (idFinal.includes('pp'))  tipoFinal = 'pp';
      else if (idFinal.includes('cbm') || idFinal.includes('bm')) tipoFinal = 'cbm';
      else if (idFinal.includes('gcm') || idFinal.includes('gm')) tipoFinal = 'gcm';
      else tipoFinal = 'adm';
    }
    return {
      id: idFinal, titulo: config.titulo || `Edital ${siglaBruta}`, banca: config.banca || 'A Definir',
      logo: config.logo || `/logosEditais/logo-${siglaLower}.png`, cargo: config.cargo || '',
      SeedComponent: Component, type: tipoFinal, isLocal: true, ativo: true, disciplinas: [],
    };
  })
  .filter(Boolean);

const LOCAL_TEMPLATES = CATALOGO_EDITAIS;

// ==================================================================================
// 🤖 SEED RUNNER
// ==================================================================================
const SeedRunner = ({ seed, onDone, onError }) => {
  const containerRef = useRef(null);
  const doneRef      = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const originalConfirm = window.confirm;
    const originalAlert   = window.alert;
    window.confirm = () => true;
    window.alert   = () => {};
    const restaurar = () => { window.confirm = originalConfirm; window.alert = originalAlert; };
    const timeoutSeguranca = setTimeout(() => {
      if (doneRef.current) return;
      restaurar(); doneRef.current = true; onError('timeout');
    }, 8000);
    const tentarClicar = (tentativa = 1) => {
      if (doneRef.current) return;
      const container = containerRef.current;
      if (!container) {
        if (tentativa < 5) setTimeout(() => tentarClicar(tentativa + 1), 200);
        else { clearTimeout(timeoutSeguranca); restaurar(); doneRef.current = true; onError('sem container'); }
        return;
      }
      let btn = Array.from(container.querySelectorAll('button')).find(b => /instalar|install|reinstalar|seed/i.test(b.textContent)) || container.querySelector('button:not([disabled])') || container.querySelector('button');
      if (!btn) {
        if (tentativa < 5) { setTimeout(() => tentarClicar(tentativa + 1), 300); return; }
        clearTimeout(timeoutSeguranca); restaurar(); doneRef.current = true; onError('botão não encontrado');
        return;
      }
      btn.click();
      setTimeout(() => {
        if (doneRef.current) return;
        clearTimeout(timeoutSeguranca); restaurar(); doneRef.current = true; onDone();
      }, 4000);
    };
    requestAnimationFrame(() => setTimeout(() => tentarClicar(), 150));
    return () => { clearTimeout(timeoutSeguranca); restaurar(); };
  }, []);

  const handleSuccess = () => { if (doneRef.current) return; doneRef.current = true; onDone(); };
  return (
    <div ref={containerRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 200, height: 60, visibility: 'hidden', pointerEvents: 'none', zIndex: -1 }} aria-hidden="true">
      <seed.SeedComponent isInstalled={false} onSuccess={handleSuccess} />
    </div>
  );
};

// ==================================================================================
// CONFIGS
// ==================================================================================
const ESTADOS_BRASIL = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CATEGORIAS_EDITAL = [
  { id: 'fa',      label: 'Forças Armadas',         icon: Target,      color: 'text-green-600'   },
  { id: 'gcm',     label: 'Guarda Municipal (GCM)', icon: Siren,       color: 'text-blue-400'    },
  { id: 'pm',      label: 'Polícia Militar (PM)',   icon: ShieldAlert, color: 'text-zinc-700'    },
  { id: 'pc',      label: 'Polícia Civil (PC)',     icon: BadgeAlert,  color: 'text-zinc-700'    },
  { id: 'pp',      label: 'Polícia Penal (PP)',     icon: Lock,        color: 'text-zinc-700'    },
  { id: 'cbm',     label: 'Bombeiros (CBM)',        icon: Flame,       color: 'text-red-500'     },
  { id: 'federal', label: 'Carreiras Federais',     icon: Globe,       color: 'text-blue-500'    },
  { id: 'adm',     label: 'Administrativo',         icon: Briefcase,   color: 'text-emerald-500' },
];
const CARGOS_POR_TIPO = {
  fa: ['Soldado','Fuzileiro Naval','Marinheiro','Sargento','Oficial','Cadete','Aprendiz','Tenente'],
  pm: ['Soldado','Oficial','Cabo','Sargento','Aluno a Oficial','Músico','Saúde'],
  pc: ['Investigador','Escrivão','Delegado','Perito Criminal','Médico Legista','Agente','Papiloscopista'],
  pp: ['Policial Penal','Agente Penitenciário','Assistente Adm.'],
  cbm: ['Soldado','Oficial','Condutor'],
  federal: ['Agente','Escrivão','Delegado','Policial Rodoviário','Agente Administrativo'],
  gcm: ['Guarda Municipal','Inspetor','Subinspetor'],
  adm: ['Assistente Administrativo','Analista Administrativo','Técnico Administrativo','Auxiliar Administrativo','Recepcionista','Secretário(a)','Contador','Gestor de RH','Analista Financeiro','Auxiliar de Escritório','Auditor','Técnico Judiciário','Analista Judiciário','Professor','Merendeira'],
};
const getPrefixoInstituicao = (tipo, estado, cidade) => {
  if (tipo === 'gcm' && cidade) return `GCM ${cidade}`.toUpperCase();
  if (['pm','pc','pp','cbm'].includes(tipo) && estado) return `${tipo.toUpperCase()}${estado.toUpperCase()}`;
  if (tipo === 'federal') return 'CONCURSO FEDERAL';
  if (tipo === 'fa') return 'FORÇAS ARMADAS';
  return null;
};

const TIPO_ATUALIZACAO_OPTIONS = [
  {
    value: 'LANCAMENTO',
    label: 'Lançamento',
    emoji: '🚀',
    desc: 'Edital publicado pela 1ª vez',
    color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200',
    activeColor: 'bg-emerald-600 border-emerald-600 text-white',
    icon: Rocket,
  },
  {
    value: 'RETIFICACAO',
    label: 'Retificação',
    emoji: '⚠️',
    desc: 'Correção oficial da banca',
    color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200',
    activeColor: 'bg-amber-600 border-amber-600 text-white',
    icon: AlertTriangle,
  },
  {
    value: 'AJUSTE_INTERNO',
    label: 'Ajuste Interno',
    emoji: '🛠️',
    desc: 'Correção de conteúdo cadastrado',
    color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
    activeColor: 'bg-blue-600 border-blue-600 text-white',
    icon: RefreshCw,
  },
];

// ==================================================================================
// 🛠️ MODAL DE CRIAÇÃO/EDIÇÃO
// ==================================================================================
const CustomEditalModal = ({ onClose, editalToEdit, showToast, allEditais }) => {
  const isEditing = !!editalToEdit;
  const [formData, setFormData] = useState({ cidade: '', estado: 'BA', titulo: '', banca: '', tipo: 'gcm', logoFile: null, logoPreview: null });
  const [cargos, setCargos] = useState([{ id: 1, nome: '', json: '' }]);
  const [activeCargoIndex, setActiveCargoIndex] = useState(0);
  const [isCustomCargo, setIsCustomCargo] = useState(false);
  const [irmao, setIrmao] = useState(null);
  const [manualOverride, setManualOverride] = useState({ banca: false, logo: false });
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // ── Bloco de IA ──
  const [tipoAtualizacao, setTipoAtualizacao] = useState('LANCAMENTO');
  const [resumoIA, setResumoIA] = useState('');
  const [gerandoIA, setGerandoIA] = useState(false);
  const [mostrarBlocoIA, setMostrarBlocoIA] = useState(true);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      setFormData({ cidade: '', estado: 'BA', titulo: editalToEdit.titulo, banca: editalToEdit.banca, tipo: editalToEdit.tipo || 'adm', logoFile: null, logoPreview: editalToEdit.logoUrl || editalToEdit.logo });
      setCargos([{ id: 1, nome: editalToEdit.cargo || '', json: JSON.stringify(editalToEdit.disciplinas || [], null, 2) }]);
      const cargosPadrao = CARGOS_POR_TIPO[editalToEdit.tipo || 'adm'] || [];
      if (editalToEdit.cargo && !cargosPadrao.includes(editalToEdit.cargo)) setIsCustomCargo(true);
      if (editalToEdit.updateMetadata) {
        setTipoAtualizacao(editalToEdit.updateMetadata.tipo || 'LANCAMENTO');
        setResumoIA(editalToEdit.updateMetadata.mensagem || '');
      }
    }
  }, [isEditing, editalToEdit]);

  useEffect(() => {
    if (isEditing) return;
    const tipoUpper = formData.tipo.toUpperCase();
    let tituloBase = '';
    if (formData.tipo === 'gcm' && formData.cidade) tituloBase = `GCM ${formData.cidade} - ${formData.estado}`;
    else if (['pm','pc','pp','cbm'].includes(formData.tipo)) tituloBase = `${tipoUpper}${formData.estado}`;
    else if (formData.tipo === 'federal') tituloBase = 'Concurso Federal';
    else if (formData.tipo === 'fa') tituloBase = 'Concurso Forças Armadas';
    const cargoAtual = cargos[activeCargoIndex]?.nome;
    let tituloFinal = tituloBase;
    if (cargos.length === 1 && cargoAtual && tituloBase && !tituloBase.includes(cargoAtual)) tituloFinal = `${tituloBase} - ${cargoAtual}`;
    const prefixo = getPrefixoInstituicao(formData.tipo, formData.estado, formData.cidade);
    let encontrado = null;
    if (prefixo && allEditais?.length) encontrado = allEditais.find(e => { const tN = (e.titulo||'').toUpperCase(); const iN = (e.instituicao||'').toUpperCase(); return tN.startsWith(prefixo) || iN.startsWith(prefixo); }) || null;
    setIrmao(encontrado);
    setFormData(prev => {
      const next = { ...prev };
      if (tituloFinal) next.titulo = tituloFinal;
      if (encontrado && !manualOverride.banca) next.banca = encontrado.banca || prev.banca;
      if (encontrado && !manualOverride.logo && !prev.logoFile) next.logoPreview = encontrado.logoUrl || encontrado.logo || prev.logoPreview;
      return next;
    });
    if (formData.tipo === 'adm' && !isEditing) setShowSidebar(true);
    else if (formData.tipo !== 'adm' && !isEditing) setShowSidebar(false);
  }, [formData.cidade, formData.estado, formData.tipo, cargos, activeCargoIndex, isEditing, allEditais]);

  const handleAddCargo = () => { setCargos(prev => [...prev, { id: Date.now(), nome: '', json: '' }]); setActiveCargoIndex(cargos.length); };
  const handleRemoveCargo = (index, e) => { e.stopPropagation(); if (cargos.length === 1) return; setCargos(cargos.filter((_, i) => i !== index)); setActiveCargoIndex(0); };
  const updateCargo = (field, value) => { const n = [...cargos]; n[activeCargoIndex][field] = value; setCargos(n); };
  const handleUseTemplate = (template) => {
    setFormData(prev => ({ ...prev, banca: template.banca, logoPreview: template.logoUrl || template.logo, titulo: template.titulo }));
    setManualOverride({ banca: true, logo: true });
    updateCargo('json', JSON.stringify(template.disciplinas || [], null, 2));
    showToast(`Dados de "${template.titulo}" copiados!`, 'success');
  };

  const handleGerarIA = async () => {
    if (!formData.titulo) { showToast('Preencha o título primeiro.', 'error'); return; }
    setGerandoIA(true);
    try {
      const nomesCargos = cargos.filter(c => c.nome).map(c => c.nome).join(', ');
      let diffDesc = nomesCargos ? `Cargos: ${nomesCargos}.` : '';
      try {
        const disciplinas = JSON.parse(cargos[activeCargoIndex]?.json || '[]');
        if (Array.isArray(disciplinas) && disciplinas.length > 0) {
          diffDesc += ` ${disciplinas.length} disciplinas incluídas: ${disciplinas.slice(0, 4).map(d => d.nome || '').filter(Boolean).join(', ')}${disciplinas.length > 4 ? ' e outras' : ''}.`;
        }
      } catch {}
      const texto = await gerarResumoAtualizacaoIA(formData.titulo, tipoAtualizacao, diffDesc || 'conteúdo atualizado');
      setResumoIA(texto);
      showToast('Texto gerado!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao contatar a IA.', 'error');
    } finally {
      setGerandoIA(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo) return showToast('Preencha o título.', 'error');
    for (let i = 0; i < cargos.length; i++) {
      if (!cargos[i].nome) return showToast(`O cargo ${i + 1} precisa de um nome.`, 'error');
      if (!cargos[i].json) return showToast(`O cargo ${cargos[i].nome} precisa de disciplinas.`, 'error');
      try { const p = JSON.parse(cargos[i].json); if (!Array.isArray(p)) throw new Error(); } catch { return showToast(`Erro no JSON do cargo ${cargos[i].nome}.`, 'error'); }
    }
    setLoading(true);
    try {
      let finalLogoUrl = formData.logoPreview;
      if (formData.logoFile) {
        const cleanType = formData.tipo.toLowerCase();
        const cleanLoc = formData.tipo === 'gcm' ? formData.cidade.toLowerCase() : formData.estado.toLowerCase();
        const sRef = ref(storage, `editais_logos/${cleanType}_${cleanLoc}_${Date.now()}`);
        const snap = await uploadBytes(sRef, formData.logoFile);
        finalLogoUrl = await getDownloadURL(snap.ref);
      } else if (!finalLogoUrl) {
        if (formData.tipo === 'pm') finalLogoUrl = '/logosEditais/logo-pm.png';
        else if (formData.tipo === 'pc') finalLogoUrl = '/logosEditais/logo-pc.png';
        else if (formData.tipo === 'cbm') finalLogoUrl = '/logosEditais/logo-cbm.png';
        else if (formData.tipo === 'fa') finalLogoUrl = '/logosEditais/logo-fa.png';
        else finalLogoUrl = '/logosEditais/logo-gcm-padrao.png';
      }

      // Só inclui updateMetadata se houver mensagem configurada
      const updateMetadata = resumoIA.trim()
        ? { tipo: tipoAtualizacao, mensagem: resumoIA.trim(), timestamp: serverTimestamp() }
        : null;

      const promises = cargos.map(async (cargo) => {
        const disciplinasParsed = JSON.parse(cargo.json);
        let docId;
        if (isEditing && cargos.length === 1) { docId = editalToEdit.id; }
        else {
          const cleanType  = formData.tipo.toLowerCase();
          const cleanCargo = cargo.nome.toLowerCase().replace(/\s+/g, '');
          const cleanLoc   = formData.tipo === 'gcm' ? (formData.cidade ? formData.cidade.toLowerCase() : 'geral') : formData.estado.toLowerCase();
          docId = `${cleanType}_${cleanLoc}_${cleanCargo}_${Math.floor(Math.random() * 10000)}`;
        }
        let tituloFinal = formData.titulo;
        if (cargos.length > 1 && !tituloFinal.toLowerCase().includes(cargo.nome.toLowerCase()))
          tituloFinal = `${tituloFinal} - ${cargo.nome}`;

        await setDoc(doc(db, 'editais_templates', docId), {
          titulo: tituloFinal,
          banca: formData.banca || 'A Definir',
          logoUrl: finalLogoUrl, logo: finalLogoUrl,
          instituicao: formData.titulo.split(' - ')[0] || formData.tipo.toUpperCase(),
          tipo: formData.tipo, cargo: cargo.nome,
          disciplinas: disciplinasParsed, isCustom: true, ativo: true,
          ...(updateMetadata ? { updateMetadata } : {}),
          lastUpdate: serverTimestamp(),
        }, { merge: true });
      });

      await Promise.all(promises);
      showToast(`${cargos.length} edital(is) salvo(s)!`, 'success');
      onClose();
    } catch (error) {
      console.error(error);
      showToast('Erro: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargosDisponiveis = CARGOS_POR_TIPO[formData.tipo] || [];
  const editaisLaterais = allEditais.filter(e => e.type === formData.tipo);
  const temIrmao = !!irmao && !isEditing;
  const tipoOpt = TIPO_ATUALIZACAO_OPTIONS.find(o => o.value === tipoAtualizacao);

  // Preview do nome legível
  const nomeFormatado = formData.titulo ? formatarNomeEditalLegivel(formData.titulo) : '';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-zinc-900/80 p-4 backdrop-blur-md">
      <div className={`modal-zoom modal-zoom--admin-editais flex h-[92vh] w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl transition-all duration-500 dark:border-zinc-700 dark:bg-zinc-900 ${showSidebar ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="flex-1 flex flex-col min-w-0">

          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center shadow-lg">
                {isEditing ? <Edit size={20} /> : <Plus size={20} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase">{isEditing ? 'Editar Edital' : 'Novo Edital'}</h3>
                <p className="text-[10px] font-bold text-zinc-400">Configure os detalhes e a notificação</p>
              </div>
            </div>
            <button onClick={() => setShowSidebar(v => !v)} className={`p-2 rounded-lg border transition-all ${showSidebar ? 'bg-red-50 border-red-200 text-red-600' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>
              <LayoutGrid size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo</label>
                <select className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none" value={formData.tipo}
                  onChange={e => { setIrmao(null); setManualOverride({ banca: false, logo: false }); setFormData(p => ({ ...p, tipo: e.target.value })); setIsCustomCargo(false); if (e.target.value === 'adm') setShowSidebar(true); }}>
                  {CATEGORIAS_EDITAL.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                </select>
              </div>
              {!isEditing && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Estado / Local</label>
                  <div className="flex gap-2">
                    <select className="w-20 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold" value={formData.estado} onChange={e => setFormData(p => ({ ...p, estado: e.target.value }))}>
                      {ESTADOS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                    {formData.tipo === 'gcm' && (
                      <input className="flex-1 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold" value={formData.cidade} onChange={e => setFormData(p => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Título</label>
                <input className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold" value={formData.titulo} onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: PMBA 2026" />
                {nomeFormatado && (
                  <p className="text-[9px] text-zinc-400 flex items-center gap-1">
                    <Info size={9} /> Será exibido como: "{nomeFormatado}"
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Banca</label>
                <div className="relative">
                  <input className={`w-full p-2.5 rounded-xl text-xs font-bold border ${temIrmao && !manualOverride.banca ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                    value={formData.banca} onChange={e => { setManualOverride(p => ({ ...p, banca: true })); setFormData(p => ({ ...p, banca: e.target.value })); }} placeholder="Banca" />
                  {temIrmao && !manualOverride.banca && <Link size={12} className="absolute right-3 top-3 text-emerald-500" />}
                </div>
              </div>
            </div>

            {/* ─── BLOCO DE NOTIFICAÇÃO IA ─── */}
            <div className="rounded-2xl overflow-hidden border border-indigo-200 dark:border-indigo-800/50">
              <button
                type="button"
                onClick={() => setMostrarBlocoIA(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/15 hover:bg-indigo-100 dark:hover:bg-indigo-900/25 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-wide">Notificação para os Alunos</span>
                  {resumoIA.trim() && (
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest">Configurada ✓</span>
                  )}
                  {!resumoIA.trim() && (
                    <span className="text-[9px] text-indigo-400 font-medium">opcional</span>
                  )}
                </div>
                <ChevronDown size={13} className={`text-indigo-500 transition-transform ${mostrarBlocoIA ? 'rotate-180' : ''}`} />
              </button>

              {mostrarBlocoIA && (
                <div className="space-y-4 bg-white p-4 dark:bg-zinc-900">

                  {/* Tipo de atualização — cards visuais */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Tipo de atualização</label>
                    <div className="grid grid-cols-3 gap-2">
                      {TIPO_ATUALIZACAO_OPTIONS.map(opt => {
                        const isActive = tipoAtualizacao === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTipoAtualizacao(opt.value)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? opt.activeColor : `border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300`}`}
                          >
                            <div className="text-base mb-1">{opt.emoji}</div>
                            <div className={`text-[11px] font-black leading-tight ${isActive ? '' : 'text-zinc-700 dark:text-zinc-300'}`}>{opt.label}</div>
                            <div className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'opacity-80' : 'text-zinc-400'}`}>{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Aviso para ajuste interno */}
                    {tipoAtualizacao === 'AJUSTE_INTERNO' && (
                      <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800/40">
                        <Info size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-blue-700 dark:text-blue-300 leading-relaxed">
                          Para ajustes internos, a notificação só aparecerá se houver mudanças substantivas (novas disciplinas, disciplinas removidas ou 3+ assuntos alterados). Pequenas correções de grafia não geram pop-up.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Campo de mensagem */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Mensagem</label>
                      <button
                        type="button"
                        onClick={handleGerarIA}
                        disabled={gerandoIA}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-bold uppercase rounded-lg transition-all"
                      >
                        {gerandoIA
                          ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</>
                          : <><Sparkles size={10} /> Gerar com IA</>
                        }
                      </button>
                    </div>
                    <textarea
                      value={resumoIA}
                      onChange={e => setResumoIA(e.target.value)}
                      placeholder={`Texto informativo que aparecerá no pop-up dos alunos com este edital no ciclo.\nDeixe em branco para não exibir pop-up.`}
                      className="w-full h-20 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 resize-none outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-400 leading-relaxed"
                    />
                    <p className="text-[9px] text-zinc-400 leading-relaxed">
                      {resumoIA.trim()
                        ? `✅ Pop-up será exibido para todos os alunos com este edital no ciclo.`
                        : `ℹ️ Sem mensagem — o sino ainda mostrará a atualização, mas sem pop-up descritivo.`
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Logo */}
            <div className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div onClick={() => fileInputRef.current?.click()} className="flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-red-500 dark:border-zinc-700 dark:bg-zinc-800">
                {formData.logoPreview ? <img src={formData.logoPreview} className="w-full h-full object-contain p-1" alt="" /> : <ImageIcon size={20} className="text-zinc-300" />}
                <input type="file" ref={fileInputRef} onChange={e => { const f = e.target.files[0]; if (f) { setManualOverride(p => ({ ...p, logo: true })); setFormData(p => ({ ...p, logoFile: f, logoPreview: URL.createObjectURL(f) })); }}} className="hidden" accept="image/*" />
              </div>
              <div className="flex-1"><p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Logotipo</p><p className="text-[10px] text-zinc-400">Clique para alterar</p></div>
              {formData.logoPreview && <button onClick={() => setFormData(p => ({ ...p, logoPreview: null, logoFile: null }))}><X size={16} className="text-zinc-400 hover:text-red-500" /></button>}
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />

            {/* Cargos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5"><Layers size={12} className="text-red-500" /> Cargos & Disciplinas</label>
                <button onClick={handleAddCargo} className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100 flex items-center gap-1"><Plus size={10} /> Adicionar Cargo</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
                {cargos.map((c, idx) => (
                  <button key={c.id} onClick={() => setActiveCargoIndex(idx)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border ${activeCargoIndex === idx ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                    {c.nome || `Cargo ${idx + 1}`}
                    {cargos.length > 1 && <span onClick={e => handleRemoveCargo(idx, e)} className="hover:text-red-500 ml-1"><X size={10} /></span>}
                  </button>
                ))}
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome do Cargo</label>
                  {cargosDisponiveis.length > 0 && !isCustomCargo ? (
                    <select className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800" value={cargos[activeCargoIndex].nome}
                      onChange={e => { if (e.target.value === 'Outro') { setIsCustomCargo(true); updateCargo('nome', ''); } else updateCargo('nome', e.target.value); }}>
                      <option value="">Selecione...</option>
                      {cargosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Outro">Outro (Digitar)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input className="flex-1 rounded-xl border border-zinc-200 bg-white p-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800" placeholder="Ex: Soldado..." value={cargos[activeCargoIndex].nome} onChange={e => updateCargo('nome', e.target.value)} />
                      {cargosDisponiveis.length > 0 && <button onClick={() => setIsCustomCargo(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"><X size={14} /></button>}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Disciplinas (JSON)</label>
                  <textarea className="h-32 w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 font-mono text-[10px] leading-relaxed outline-none custom-scrollbar focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-800"
                    value={cargos[activeCargoIndex].json} onChange={e => updateCargo('json', e.target.value)}
                    placeholder={`[\n  { "nome": "Português", "assuntos": ["Crase"] }\n]`} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 rounded-b-3xl border-t border-zinc-100 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900">
            <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
              {loading ? 'Salvando...' : <><Save size={14} /> Salvar {cargos.length} Cargo(s)</>}
            </button>
          </div>
        </div>

        {showSidebar && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} className="border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-black text-zinc-500 uppercase">Modelos</span>
              <button onClick={() => setShowSidebar(false)}><X size={14} className="text-zinc-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {editaisLaterais.length > 0 ? editaisLaterais.map(template => (
                <div key={template.id} className="rounded-xl border border-zinc-200 bg-white p-3 transition-all hover:border-red-300 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-center gap-3 mb-2">
                    <img src={template.logoUrl || template.logo} className="w-8 h-8 object-contain opacity-80" alt="" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-white truncate">{template.titulo}</p>
                      <p className="text-[10px] text-zinc-500">{template.banca}</p>
                    </div>
                  </div>
                  <button onClick={() => handleUseTemplate(template)} className="w-full py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                    <Copy size={10} /> Copiar Dados
                  </button>
                </div>
              )) : <div className="text-center py-10 text-zinc-400 text-xs">Nenhum modelo encontrado.</div>}
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
  const [syncingSeeds, setSyncingSeeds]       = useState(false);
  const [syncLabel, setSyncLabel]             = useState('');
  const [seedAtual, setSeedAtual]             = useState(null);
  const [seedQueue, setSeedQueue]             = useState([]);
  const [pendingAction, setPendingAction]     = useState(null);
  const syncStatsRef                          = useRef({ ok: 0, erros: [], total: 0 });

  const triggerToast = (msg, type = 'success') => setToast({ message: msg, type });

  useBodyScrollLock(isOpen, { fixed: false });

  useEffect(() => {
    if (!isOpen) return undefined;
    const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
      setDbTemplates(snap.docs.map(d => ({ id: d.id, ...d.data(), isInstalled: true })));
    });
    return () => unsub();
  }, [isOpen]);

  const allEditais = useMemo(() => {
    const dbMap = new Map(dbTemplates.map(t => [t.id, t]));
    const localWithOverrides = LOCAL_TEMPLATES
      .filter(loc => !dbMap.get(loc.id)?.deleted)
      .map(loc => { const dbV = dbMap.get(loc.id); if (dbV) return { ...loc, ...dbV, logo: dbV.logoUrl || dbV.logo || loc.logo, SeedComponent: loc.SeedComponent, isLocal: true, isInstalled: true }; return loc; });
    const customTemplates = dbTemplates
      .filter(dbT => !LOCAL_TEMPLATES.find(loc => loc.id === dbT.id) && !dbT.deleted)
      .map(t => ({ ...t, logo: t.logoUrl || t.logo, type: t.tipo || 'adm', isCustom: true, isInstalled: true, ativo: t.ativo !== undefined ? t.ativo : true }));
    return [...localWithOverrides, ...customTemplates];
  }, [dbTemplates]);

  const avancarFila = (sucesso, nomeErro = '') => {
    if (sucesso) syncStatsRef.current.ok++;
    else syncStatsRef.current.erros.push(nomeErro);
    setSeedQueue(prev => {
      const novaFila = prev.slice(1);
      const proximo  = novaFila[0] || null;
      const feito = syncStatsRef.current.ok + syncStatsRef.current.erros.length;
      setSyncLabel(proximo ? `${feito + 1}/${syncStatsRef.current.total} — ${proximo.titulo}` : '');
      setSeedAtual(proximo);
      if (!proximo) {
        setSyncingSeeds(false);
        const { ok, erros } = syncStatsRef.current;
        if (erros.length > 0) triggerToast(`${ok} instalados. ${erros.length} falharam.`, 'error');
        else triggerToast(`${ok} seeds sincronizados! ✅`, 'success');
      }
      return novaFila;
    });
  };

  const handleSincronizarSeeds = () => {
    if (syncingSeeds) return;
    const seeds = CATALOGO_EDITAIS.filter(s => s.SeedComponent);
    if (!seeds.length) { triggerToast('Nenhum seed encontrado.', 'error'); return; }
    setPendingAction({ type: 'syncSeeds', count: seeds.length });
  };

  const confirmarSincronizacaoSeeds = () => {
    const seeds = CATALOGO_EDITAIS.filter(s => s.SeedComponent);
    syncStatsRef.current = { ok: 0, erros: [], total: seeds.length };
    setSyncingSeeds(true);
    setSyncLabel(`1/${seeds.length} — ${seeds[0].titulo}`);
    setSeedQueue(seeds);
    setSeedAtual(seeds[0]);
  };

  const removerEdital = async (edital) => {
    const isCustom = edital.isCustom || edital.isCustomGCM;
    const isSeed = edital.isLocal;
    try {
      if (isCustom && !isSeed) await deleteDoc(doc(db, 'editais_templates', edital.id));
      else await setDoc(doc(db, 'editais_templates', edital.id), { deleted: true, ativo: false, lastUpdate: serverTimestamp() }, { merge: true });
      triggerToast('Edital removido!');
    } catch (e) {
      triggerToast('Erro: ' + e.message, 'error');
    }
  };

  const confirmarAcaoPendente = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action?.type === 'syncSeeds') confirmarSincronizacaoSeeds();
    if (action?.type === 'deleteEdital') await removerEdital(action.edital);
  };

  if (!isOpen) return null;

  const categories = [
    { id: 'todos',   label: 'Todos',           icon: LayoutGrid,  color: 'text-zinc-500'    },
    { id: 'fa',      label: 'Forças Armadas',  icon: Target,      color: 'text-green-600'   },
    { id: 'federal', label: 'Federais',        icon: Globe,       color: 'text-blue-500'    },
    { id: 'pm',      label: 'Polícia Militar', icon: ShieldAlert, color: 'text-zinc-700'    },
    { id: 'pc',      label: 'Polícia Civil',   icon: BadgeAlert,  color: 'text-zinc-700'    },
    { id: 'pp',      label: 'Polícia Penal',   icon: Lock,        color: 'text-zinc-700'    },
    { id: 'cbm',     label: 'Bombeiros',       icon: Flame,       color: 'text-red-500'     },
    { id: 'gcm',     label: 'Guarda Mun.',     icon: Siren,       color: 'text-blue-400'    },
    { id: 'adm',     label: 'Administrativo',  icon: Briefcase,   color: 'text-emerald-500' },
  ];

  const filteredEditais = allEditais.filter(e => {
    const matchTab    = activeTab === 'todos' || e.type === activeTab;
    const matchSearch = (e.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.banca || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchTab && matchSearch;
  });

  const EditalCard = ({ edital }) => {
    const SeedBtn = edital.SeedComponent;
    const isCustom = edital.isCustom || edital.isCustomGCM;
    const isAtivo = edital.ativo !== false;
    const isSeed = edital.isLocal;

    const handleToggleStatus = async () => { try { await setDoc(doc(db, 'editais_templates', edital.id), { ativo: !isAtivo, lastUpdate: serverTimestamp() }, { merge: true }); triggerToast(`Edital ${!isAtivo ? 'ativado' : 'arquivado'}!`); } catch (e) { triggerToast('Erro: ' + e.message, 'error'); } };
    const handleDelete = async () => {
      setPendingAction({ type: 'deleteEdital', edital });
    };

    return (
      <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-full overflow-hidden ${!isAtivo ? 'opacity-60 grayscale bg-zinc-100 dark:bg-zinc-900 border-dashed' : edital.isInstalled ? 'bg-white dark:bg-zinc-900 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-red-300'}`}>
        {edital.isInstalled && isAtivo && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl z-20">INSTALADO</div>}
        {!isAtivo && <div className="absolute top-0 right-0 bg-zinc-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl z-20">ARQUIVADO</div>}
        {isSeed && isAtivo && <div className="absolute top-0 left-0 bg-indigo-500/80 text-white text-[8px] font-black px-2 py-0.5 rounded-br-lg z-20">SEED</div>}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 p-2 shadow-inner transition-transform duration-500 group-hover:scale-105 dark:border-zinc-700 dark:bg-zinc-800">
            <img src={edital.logoUrl || edital.logo} className="w-full h-full object-contain drop-shadow-sm" alt="logo" onError={e => { e.target.src = '/vite.svg'; }} />
          </div>
          <div className="pt-1 overflow-hidden">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight mb-1 truncate pr-2 group-hover:text-red-600 transition-colors">{edital.titulo}</h4>
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md uppercase">{edital.banca}</span>
              {edital.cargo && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md uppercase">{edital.cargo}</span>}
              {isCustom && !edital.cargo && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase">Custom</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
          <div className="flex-1 min-w-0">
            {SeedBtn ? <SeedBtn isInstalled={edital.isInstalled} /> : (
              <button disabled={!isAtivo} className={`w-full px-4 py-2 rounded-xl text-xs font-bold uppercase bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800 cursor-default flex items-center justify-center gap-2 ${!isAtivo ? 'opacity-50' : ''}`}>
                <CheckCircle2 size={14} /> {isAtivo ? 'Disponível' : 'Indisponível'}
              </button>
            )}
          </div>
          <button onClick={() => { setEditalToEdit(edital); setShowCustomModal(true); }} className="p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-200 rounded-xl transition-all"><Edit size={16} /></button>
          <button onClick={handleToggleStatus} className="p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all">{isAtivo ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button onClick={handleDelete} className="p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={16} /></button>
        </div>
      </motion.div>
    );
  };

  return createPortal(
    <>
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-zinc-900/70 p-3 font-sans backdrop-blur-md sm:p-5 md:p-7">
      <style>{`.custom-scrollbar{scrollbar-width:thin;scrollbar-color:#ef4444 transparent}.custom-scrollbar::-webkit-scrollbar{width:6px}.custom-scrollbar::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#ef4444,#991b1b);border-radius:10px}`}</style>

      {seedAtual && (
        <SeedRunner
          key={seedAtual.id} seed={seedAtual}
          onDone={() => avancarFila(true)}
          onError={(motivo) => { console.warn(`[Sync] erro em "${seedAtual.titulo}":`, motivo); avancarFila(false, seedAtual.titulo); }}
        />
      )}

      <AnimatePresence>{toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>
      <AnimatePresence>{showCustomModal && <CustomEditalModal onClose={() => { setShowCustomModal(false); setEditalToEdit(null); }} editalToEdit={editalToEdit} showToast={triggerToast} allEditais={allEditais} />}</AnimatePresence>

      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="admin-modal-shell admin-modal-shell--editais modal-zoom modal-zoom--admin-editais flex h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:h-[calc(100dvh-2.5rem)] md:h-[calc(100dvh-3.5rem)] md:w-[96vw] md:max-w-[1500px] md:rounded-[2rem] lg:h-[88dvh]">

        <div className="admin-modal-heading admin-editais-heading px-5 py-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600 flex items-center justify-center border border-red-100 dark:border-red-800/30"><Server size={24} /></div>
            <div><h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">Central de Editais</h3><p className="text-xs font-bold text-zinc-400 uppercase">Gerencie e instale novos concursos</p></div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
            <button onClick={handleSincronizarSeeds} disabled={syncingSeeds}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all hover:-translate-y-0.5 min-w-[200px] justify-center">
              {syncingSeeds
                ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" /><span className="truncate max-w-[180px]">{syncLabel}</span></>
                : <><Download size={14} /> Sincronizar Seeds ({CATALOGO_EDITAIS.length})</>
              }
            </button>
            <button onClick={() => { setEditalToEdit(null); setShowCustomModal(true); }} className="flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all hover:-translate-y-0.5 group">
              <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Novo Edital
            </button>
            <div className="relative w-full md:w-72 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar edital..." className="w-full pl-12 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none placeholder:text-zinc-400" />
            </div>
            <button onClick={onClose} className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-500 hover:text-red-600"><X size={20} /></button>
          </div>
        </div>

        <div className="admin-modal-body admin-editais-content flex-1 flex flex-col overflow-hidden">
          <div className="px-8 pt-6 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
              {categories.map(cat => {
                const isActive = activeTab === cat.id;
                return (
                  <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border uppercase tracking-wide ${isActive ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 shadow-lg' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}>
                    <cat.icon size={14} className={isActive ? '' : cat.color} />{cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
            <div className="admin-editais-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredEditais.map(edital => <EditalCard key={edital.id} edital={edital} />)}
              </AnimatePresence>
              {filteredEditais.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-400">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4"><LayoutGrid size={40} className="opacity-20" /></div>
                  <p className="font-bold text-lg">Nenhum edital encontrado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    <ConfirmModal
      isOpen={!!pendingAction}
      onClose={() => setPendingAction(null)}
      onConfirm={confirmarAcaoPendente}
      title={pendingAction?.type === 'syncSeeds' ? 'Sincronizar seeds?' : 'Remover edital?'}
      message={pendingAction?.type === 'syncSeeds'
        ? `Serão instalados ou atualizados ${pendingAction?.count || 0} editais no Firestore.`
        : `O edital "${pendingAction?.edital?.titulo || ''}" será removido${pendingAction?.edital?.isLocal ? ' e o seed ficará oculto' : ''}.`}
      confirmText={pendingAction?.type === 'syncSeeds' ? 'Sincronizar' : 'Remover'}
      isDestructive={pendingAction?.type !== 'syncSeeds'}
    />
    </>
    ,
    document.body,
  );
};

export default EditaisManagerModal;
