import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebaseConfig'; // Certifique-se que o firebaseConfig está na raiz do src, senão ajuste aqui tbm
import { collection, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import {
  ShieldAlert, BadgeAlert, Lock, Flame, Siren, LayoutGrid,
  CheckCircle2, Trash2, X, Server, Globe, Search
} from 'lucide-react';

// ==================================================================================
// 🚀 AUTOMATIZAÇÃO DE EDITAIS (CAMINHO CORRIGIDO)
// ==================================================================================
// Ajustado para buscar na pasta src/components/admin
const seedModules = import.meta.glob('../../components/admin/SeedEdital*.jsx', { eager: true });

export const CATALOGO_EDITAIS = Object.entries(seedModules)
  .map(([path, module]) => {
    const Component = module.default;
    if (!Component) return null;

    const config = module.editalConfig || {};
    // Pega apenas o nome do arquivo, ignorando as pastas
    const fileName = path.split('/').pop().replace('.jsx', '');
    const siglaBruta = fileName.replace('SeedEdital', '');
    const siglaLower = siglaBruta.toLowerCase();

    const idFinal = config.id || siglaLower;
    const tituloFinal = config.titulo || `Edital ${siglaBruta}`;
    const bancaFinal = config.banca || 'A Definir';

    let tipoFinal = config.tipo;
    if (!tipoFinal) {
      // Lógica de Categorização Automática
      if (idFinal.includes('pf') || idFinal.includes('prf') || idFinal.includes('depen') || idFinal.includes('federal')) tipoFinal = 'federal';
      else if (idFinal.includes('pm')) tipoFinal = 'pm';
      else if (idFinal.includes('pc')) tipoFinal = 'pc';
      else if (idFinal.includes('pp')) tipoFinal = 'pp';
      else if (idFinal.includes('cbm') || idFinal.includes('bm')) tipoFinal = 'cbm';
      else if (idFinal.includes('gcm') || idFinal.includes('gm')) tipoFinal = 'gcm';
      else tipoFinal = 'outros';
    }

    let logoFinal = config.logo || `/logosEditais/logo-${siglaLower}.png`;

    // Fallbacks manuais (mantidos para compatibilidade)
    if (!config.logo && siglaLower.includes('aquiraz')) logoFinal = '/logosEditais/logo-aquiraz.png';
    if (!config.logo && siglaLower.includes('recife')) logoFinal = '/logosEditais/logo-recife.png';

    return {
      id: idFinal,
      titulo: tituloFinal,
      banca: bancaFinal,
      logo: logoFinal,
      SeedComponent: Component,
      type: tipoFinal
    };
  })
  .filter(Boolean);

// --- COMPONENTE MODAL DE EDITAIS ---
const EditaisManagerModal = ({ isOpen, onClose }) => {
  const [installedTemplates, setInstalledTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';

    if (!isOpen) return;

    const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
      const ids = snap.docs.map(d => d.id);
      setInstalledTemplates(ids);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Definição das Categorias
  const categories = [
    { id: 'todos', label: 'Todos', icon: LayoutGrid, color: 'text-zinc-500' },
    { id: 'federal', label: 'Federais', icon: Globe, color: 'text-blue-500' },
    { id: 'pm', label: 'Polícia Militar', icon: ShieldAlert, color: 'text-zinc-700' },
    { id: 'pc', label: 'Polícia Civil', icon: BadgeAlert, color: 'text-zinc-700' },
    { id: 'pp', label: 'Polícia Penal', icon: Lock, color: 'text-zinc-700' },
    { id: 'cbm', label: 'Bombeiros', icon: Flame, color: 'text-red-500' },
    { id: 'gcm', label: 'Guarda Mun.', icon: Siren, color: 'text-blue-400' },
  ];

  // Filtragem
  const filteredEditais = CATALOGO_EDITAIS.filter(e => {
    const matchesTab = activeTab === 'todos' ? true : e.type === activeTab;
    const matchesSearch = e.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.banca.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const EditalCard = ({ edital }) => {
    const isInstalled = installedTemplates.includes(edital.id);
    const SeedBtn = edital.SeedComponent;

    const handleDelete = async () => {
      if (window.confirm(`ATENÇÃO: Deseja apagar o template "${edital.titulo}" do banco de dados? Isso afetará a criação de novos ciclos para este edital.`)) {
        try {
          await deleteDoc(doc(db, 'editais_templates', edital.id));
        } catch (e) {
          alert("Erro ao remover: " + e.message);
        }
      }
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg flex flex-col justify-between h-full
          ${isInstalled
            ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-zinc-900 border-emerald-200 dark:border-emerald-800/50'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/50'
          }`}
      >
        {/* Status Badge Absolute */}
        {isInstalled && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> INSTALADO
          </div>
        )}

        <div className="flex items-start gap-4 mb-4">
          {/* Logo Area */}
          <div className="w-16 h-16 shrink-0 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-center p-2 shadow-sm group-hover:scale-105 transition-transform">
            <img
              src={edital.logo}
              className="w-full h-full object-contain"
              alt="logo"
              onError={(e) => { e.target.src = '/vite.svg'; }}
            />
          </div>

          {/* Info Area */}
          <div className="pt-1">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight mb-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              {edital.titulo}
            </h4>
            <p className="text-[11px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md inline-block">
              {edital.banca}
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
          <div className="flex-1">
             {/* O SeedBtn geralmente é um botão grande, vamos deixar ele ocupar o espaço */}
             <SeedBtn isInstalled={isInstalled} />
          </div>

          {isInstalled && (
            <button
              onClick={handleDelete}
              className="p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors tooltip-trigger"
              title="Remover template do banco"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-zinc-50 dark:bg-zinc-950 w-full max-w-7xl max-h-[92vh] rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-xl text-red-600">
                <Server size={24} />
             </div>
             <div>
               <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                 Central de Editais
               </h3>
               <p className="text-xs text-zinc-500 font-medium">
                 Gerencie os templates disponíveis para os alunos
               </p>
             </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar edital..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
             </div>
             <button
               onClick={onClose}
               className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-500"
             >
               <X size={20} />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* Tabs Scrollable */}
            <div className="px-6 pt-6 pb-2 bg-zinc-50 dark:bg-zinc-950">
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {categories.map(cat => {
                  const isActive = activeTab === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveTab(cat.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-lg shadow-zinc-500/20'
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

            {/* Grid Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {filteredEditais.map((edital) => (
                        <EditalCard key={edital.id} edital={edital} />
                    ))}
                  </AnimatePresence>

                  {filteredEditais.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-400">
                        <LayoutGrid size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">Nenhum edital encontrado nesta categoria.</p>
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