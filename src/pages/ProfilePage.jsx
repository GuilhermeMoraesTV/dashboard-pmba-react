import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, storage } from '../firebaseConfig.js';
import {
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  deleteUser,
  updateProfile
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AnimatePresence, motion } from 'framer-motion';

import { useCiclos } from '../hooks/useCiclos'; // Adicionado para Actions

import {
  User, Save, X, BarChart2, Archive, Loader2, Upload, Trash2,
  Calendar, Clock, CheckSquare, History, Shield, Mail, Key,
  AlertTriangle, ChevronDown, ChevronUp, Camera, Target, Zap,
  ArchiveRestore, Search, LayoutDashboard, ArrowLeft, Filter
} from 'lucide-react';

// --- SUB-COMPONENTE: Modal Genérico Estilizado ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full ${maxWidth} border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden relative`}
            >
                 {/* Watermark */}
                 <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                    <Target size={200} />
                 </div>

                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-full text-zinc-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-0 overflow-y-auto custom-scrollbar flex-1 z-10 bg-zinc-50/30 dark:bg-zinc-900/30">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

// --- SUB-COMPONENTE: Card de Estatística ---
const StatCard = ({ icon: Icon, label, value, subtext, colorClass, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
    >
        <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass} rotate-12`}>
            <Icon size={100} />
        </div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} dark:bg-opacity-10`}>
                <Icon size={24} className={colorClass} />
            </div>
            <h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{value}</h4>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-1">{label}</p>
            {subtext && <p className="text-[10px] text-zinc-400 mt-2 font-medium">{subtext}</p>}
        </div>
    </motion.div>
);

// --- NOVO: Modal de Confirmação de Exclusão Permanente ---
function ModalConfirmacaoExclusao({ ciclo, onClose, onConfirm, loading }) {
    if (!ciclo) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-red-500/10 p-6 flex flex-col items-center border-b border-red-500/20">
                    <div className="w-16 h-16 bg-red-500/20 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <Trash2 size={32} />
                    </div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                        Excluir Permanentemente?
                    </h2>
                </div>
                <div className="p-6 text-center">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                        O ciclo <strong className="text-red-600 dark:text-red-400 font-bold">"{ciclo.nome}"</strong> será <strong className="text-red-600">apagado permanentemente</strong> do Firebase, incluindo todas as suas disciplinas e tópicos.
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 font-medium mb-6">
                        **Esta ação não pode ser desfeita.** Seus registros de estudo (horas) permanecerão no histórico geral.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                        <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">
                            {loading ? "Apagando..." : "Confirmar Exclusão"}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
// --- FIM DO NOVO MODAL ---


function ProfilePage({ user, allRegistrosEstudo = [], onDeleteRegistro }) {
  // --- Estados ---
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDangerZone, setShowDangerZone] = useState(false);

  // Estados de Foto
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Modais
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showArchivesModal, setShowArchivesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Histórico Avançado
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [historySearch, setHistorySearch] = useState('');

  // Dados
  const [todosCiclos, setTodosCiclos] = useState([]); // Carrega todos os ciclos para referência
  const [loadingCiclos, setLoadingCiclos] = useState(true);

  // NOVO: Estados para Confirmação de Exclusão de Ciclo
  const [cicloParaExcluir, setCicloParaExcluir] = useState(null);
  const [showDeleteCycleConfirm, setShowDeleteCycleConfirm] = useState(false);

  // NOVO: Hook para ações de ciclo
  const { excluirCicloPermanente, loading: cicloActionLoading } = useCiclos(user);


  // --- NOVO: Auto-hide Message ---
  useEffect(() => {
    if (message.text) {
        const timer = setTimeout(() => {
            setMessage({ type: '', text: '' });
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [message]);

  // Cálculo de Estatísticas Gerais
  const stats = useMemo(() => {
    const totalRegistros = allRegistrosEstudo.length;
    const totalMinutos = allRegistrosEstudo.reduce((acc, curr) => acc + (curr.tempoEstudadoMinutos || 0), 0);
    const horasTotais = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;
    const diasAtivos = Math.floor((Date.now() - new Date(user?.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24));
    return { totalRegistros, horasTotais, minutosRestantes, diasAtivos };
  }, [allRegistrosEstudo, user]);

  // Carrega TODOS os ciclos (Ativos e Arquivados) para mapeamento
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, orderBy('dataCriacao', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTodosCiclos(lista);
      setLoadingCiclos(false);
    }, (error) => {
      console.error("Erro ao carregar ciclos:", error);
      setLoadingCiclos(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Ciclos Arquivados (Derivado)
  const ciclosArquivados = useMemo(() => todosCiclos.filter(c => c.arquivado === true), [todosCiclos]);

  // --- LÓGICA PRINCIPAL DE AGRUPAMENTO DO HISTÓRICO ---
  const groupedHistory = useMemo(() => {
      if (loadingCiclos) return [];

      const groups = {};
      const ciclosMap = new Map(todosCiclos.map(c => [c.id, c]));

      allRegistrosEstudo.forEach(reg => {
          const cId = reg.cicloId;

          if (cId && !ciclosMap.has(cId)) {
              return;
          }

          const effectiveId = cId || 'sem-ciclo';
          let cNome = 'Geral / Sem Ciclo';

          if (cId && ciclosMap.has(cId)) {
              cNome = ciclosMap.get(cId).nome;
          } else if (reg.cicloNome) {
              cNome = reg.cicloNome;
          }

          if (!groups[effectiveId]) {
              groups[effectiveId] = {
                  id: effectiveId,
                  nome: cNome,
                  registros: [],
                  totalMinutos: 0,
                  totalQuestoes: 0,
                  totalAcertos: 0,
                  ultimaAtividade: reg.data
              };
          }

          groups[effectiveId].registros.push(reg);
          groups[effectiveId].totalMinutos += (reg.tempoEstudadoMinutos || 0);
          groups[effectiveId].totalQuestoes += (reg.questoesFeitas || 0);
          groups[effectiveId].totalAcertos += (reg.acertos || 0);

          if (reg.data > groups[effectiveId].ultimaAtividade) {
              groups[effectiveId].ultimaAtividade = reg.data;
          }
      });

      return Object.values(groups).sort((a, b) => b.ultimaAtividade.localeCompare(a.ultimaAtividade));
  }, [allRegistrosEstudo, todosCiclos, loadingCiclos]);

  // Filtragem por Busca
  const filteredHistory = useMemo(() => {
      const term = historySearch.toLowerCase();

      if (!selectedCycleId) {
          return groupedHistory.filter(g => g.nome.toLowerCase().includes(term));
      } else {
          const group = groupedHistory.find(g => g.id === selectedCycleId);
          if (!group) return [];
          return group.registros.filter(r =>
              r.disciplinaNome.toLowerCase().includes(term) ||
              (r.topicoNome && r.topicoNome.toLowerCase().includes(term))
          );
      }
  }, [groupedHistory, selectedCycleId, historySearch]);

  const activeCycleData = useMemo(() =>
      groupedHistory.find(g => g.id === selectedCycleId),
  [groupedHistory, selectedCycleId]);


  useEffect(() => {
    setPhotoPreview(user?.photoURL);
  }, [user?.photoURL]);

  // --- Handlers de Ações ---
  const handleUpdatePhoto = async () => {
      if (!photo) return;
      setPhotoLoading(true);
      try {
        const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
        const snapshot = await uploadBytes(storageRef, photo);
        const photoURL = await getDownloadURL(snapshot.ref);

        await updateProfile(auth.currentUser, { photoURL });
        await setDoc(doc(db, 'users', user.uid), { photoURL }, { merge: true });

        await auth.currentUser.reload();

        setMessage({ type: 'success', text: 'Foto de perfil atualizada.' });
        setPhoto(null);
      } catch (error) {
        console.error("Erro detalhado:", error);
        setMessage({ type: 'error', text: 'Falha ao atualizar foto.' });
      } finally {
        setPhotoLoading(false);
      }
    };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user.email) return;
    try {
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      setMessage({ type: 'success', text: `Link de verificação enviado para ${newEmail}.` });
      setIsEditingEmail(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao atualizar e-mail.' });
    }
  };

  const handleSendPasswordReset = async () => {
    setSenhaLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: `Link enviado para ${user.email}.` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao enviar email.' });
    } finally {
      setSenhaLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
      if(!deletePassword) return;
      try {
          const credential = EmailAuthProvider.credential(user.email, deletePassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await deleteUser(auth.currentUser);
      } catch (e) {
          setMessage({type: 'error', text: 'Senha incorreta.'});
      }
  };

  const handleUnarchive = async (id) => {
      await updateDoc(doc(db, 'users', user.uid, 'ciclos', id), { arquivado: false });
  };

  // Ação que abre o modal de confirmação
  const handleDeletePermanent = (ciclo) => {
      setCicloParaExcluir(ciclo);
      setShowDeleteCycleConfirm(true);
  };

  // Ação que CONFIRMA a exclusão permanente (chamada pelo modal)
  const handleConfirmPermanentDelete = async () => {
      if (!cicloParaExcluir || cicloActionLoading) return;

      const { id, nome } = cicloParaExcluir;
      setShowDeleteCycleConfirm(false); // Fecha o modal antes de começar o processamento

      const sucesso = await excluirCicloPermanente(id);

      if (sucesso) {
          setMessage({ type: 'success', text: `Ciclo "${nome}" excluído permanentemente.` });
      } else {
          setMessage({ type: 'error', text: `Falha ao excluir ciclo.` });
      }
      setCicloParaExcluir(null);
  };


  const formatTime = (min) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h ${m}m`;
  };

  if (!user) return <div className="p-8 text-center text-zinc-500 font-bold animate-pulse">Carregando dados do usuario...</div>;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20 pt-10 px-4">

      {/* --- HEADER MINIMALISTA (SEM BANNER) --- */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-8 mb-12">

          {/* Foto de Perfil */}
          <div className="relative group/avatar flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-2xl overflow-hidden relative ring-4 ring-zinc-100 dark:ring-zinc-900/50">
                  {photoPreview ? (
                      <img src={photoPreview} alt="User" className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-200 dark:bg-zinc-800"><User size={48}/></div>
                  )}

                  {/* Overlay de Upload */}
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                      <Camera size={24} className="mb-1" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Editar</span>
                      <input type="file" accept="image/*" onChange={(e) => {
                          if(e.target.files?.[0]) {
                              setPhoto(e.target.files[0]);
                              setPhotoPreview(URL.createObjectURL(e.target.files[0]));
                          }
                      }} className="hidden" />
                  </label>
              </div>
              {/* Status Dot */}
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-zinc-950 rounded-full shadow-sm z-10" title="Status: Operacional"></div>
          </div>

          {/* Textos */}
          <div className="flex-1 text-center md:text-left space-y-2">
              <div className="inline-block px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Ficha do Usuario
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">
                {user.displayName || 'Usuário'}
              </h1>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-center md:justify-start gap-2">
                  <Mail size={14} className="text-red-600" /> {user.email}
              </p>

              {/* Botão de Salvar Foto (Condicional) */}
              <AnimatePresence>
                {photo && (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:10}} className="pt-2">
                        <button
                            onClick={handleUpdatePhoto}
                            disabled={photoLoading}
                            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all mx-auto md:mx-0"
                        >
                            {photoLoading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                            Confirmar Foto
                        </button>
                    </motion.div>
                )}
              </AnimatePresence>
          </div>
      </div>

      {/* Feedback Toast */}
      <AnimatePresence>
        {message.text && (
            <motion.div initial={{opacity: 0, y: -20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} className="fixed top-6 right-6 z-[100]">
                <div className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>
                    {message.type === 'success' ? <CheckSquare size={18}/> : <AlertTriangle size={18}/>}
                    <span className="font-bold text-sm">{message.text}</span>
                    <button onClick={() => setMessage({type:'', text:''})} className="ml-2 hover:opacity-50"><X size={14}/></button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- DASHBOARD DE ESTATÍSTICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Clock}
            label="Tempo Total em Foco"
            value={`${stats.horasTotais}h ${stats.minutosRestantes}m`}
            subtext="Acumulado em todas as disciplinas"
            colorClass="text-emerald-600"
            delay={0.1}
          />
          <StatCard
            icon={CheckSquare}
            label="Estudos Registrados"
            value={stats.totalRegistros}
            subtext="Registros de estudo efetuados"
            colorClass="text-indigo-600"
            delay={0.2}
          />
          <StatCard
            icon={Calendar}
            label="Dias na plataforma"
            value={stats.diasAtivos}
            subtext="Desde o cadastro na plataforma"
            colorClass="text-amber-600"
            delay={0.3}
          />
           <motion.button
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.4 }}
             onClick={() => { setShowHistoryModal(true); setSelectedCycleId(null); setHistorySearch(''); }}
             className="relative overflow-hidden bg-zinc-900 dark:bg-white border border-zinc-900 dark:border-white p-6 rounded-2xl shadow-sm group hover:shadow-xl transition-all text-left flex flex-col justify-between min-h-[140px]"
           >
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <LayoutDashboard size={80} className="text-white dark:text-zinc-900" />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white/20 dark:bg-zinc-900/10">
                        <LayoutDashboard size={24} className="text-white dark:text-zinc-900" />
                    </div>
                    <h4 className="text-lg font-black text-white dark:text-zinc-900 uppercase leading-none">Histórico de Registros</h4>
                    <p className="text-[10px] font-bold text-white/60 dark:text-zinc-500 uppercase tracking-wide mt-1 group-hover:translate-x-1 transition-transform">Acessar Registros por Ciclo →</p>
                </div>
           </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">

          {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
          <div className="lg:col-span-2 space-y-6">

              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none"><Shield size={300}/></div>

                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-8 flex items-center gap-2 relative z-10">
                      <Shield size={16} className="text-red-600"/> Credenciais & Segurança
                  </h3>

                  <div className="space-y-8 relative z-10">
                      {/* Email */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                          <div>
                              <h4 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                <Mail size={16} className="text-zinc-400"/> Endereço de E-mail
                              </h4>
                              <p className="text-xs text-zinc-500 mt-1 max-w-xs">Usado para acesso ao painel e comunicações oficiais.</p>
                          </div>
                          {!isEditingEmail ? (
                              <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 pl-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                  <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">{user.email}</span>
                                  <button onClick={() => setIsEditingEmail(true)} className="p-2 bg-white dark:bg-zinc-700 hover:text-indigo-500 rounded-lg shadow-sm transition-colors"><div className="sr-only">Editar</div><Upload size={14} className="rotate-90"/></button>
                              </div>
                          ) : (
                              <div className="flex gap-2 w-full sm:w-auto animate-fade-in">
                                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500" />
                                  <button onClick={handleUpdateEmail} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><CheckSquare size={18}/></button>
                                  <button onClick={() => setIsEditingEmail(false)} className="p-2.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl"><X size={18}/></button>
                              </div>
                          )}
                      </div>

                      {/* Senha */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                              <h4 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                <Key size={16} className="text-zinc-400"/> Senha de Acesso
                              </h4>
                              <p className="text-xs text-zinc-500 mt-1 max-w-xs">Recomendamos a alteração periódica para segurança.</p>
                          </div>
                          <button
                            onClick={handleSendPasswordReset}
                            disabled={senhaLoading}
                            className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-red-500 transition-all flex items-center gap-2 shadow-sm"
                          >
                             {senhaLoading ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} />}
                             Enviar Link de Redefinição
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* COLUNA DIREITA: ARQUIVO MORTO & EXTAS */}
          <div className="space-y-6">
               <div className="bg-zinc-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500"><Archive size={120}/></div>
                   <div className="relative z-10">
                       <h4 className="text-2xl font-black mb-1">{ciclosArquivados.length}</h4>
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Ciclos Arquivadas</p>

                       <button onClick={() => setShowArchivesModal(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 backdrop-blur-sm transition-colors">
                           <Archive size={14}/> Acessar Arquivo
                       </button>
                   </div>
               </div>

               {/* ZONA DE PERIGO (Colapsável) */}
               <div className="bg-red-50 dark:bg-red-900/5 border border-red-100 dark:border-red-900/20 rounded-3xl overflow-hidden transition-all duration-300">
                    <button
                        onClick={() => setShowDangerZone(!showDangerZone)}
                        className="w-full flex items-center justify-between p-6 text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                                <AlertTriangle size={20}/>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-red-900 dark:text-red-400 uppercase tracking-wide">Ações Críticas</h4>
                                <p className="text-[10px] text-red-700/60 dark:text-red-400/60">Exclusão de conta e dados</p>
                            </div>
                        </div>
                        {showDangerZone ? <ChevronUp size={18} className="text-red-400"/> : <ChevronDown size={18} className="text-red-400"/>}
                    </button>

                    <AnimatePresence>
                        {showDangerZone && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 pb-6"
                            >
                                <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-red-100 dark:border-red-900/30">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                                        Esta ação é <strong className="text-red-600">irreversível</strong>. Todos os seus ciclos, registros e estatísticas serão apagados permanentemente dos nossos servidores.
                                    </p>

                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                                        >
                                            Solicitar Exclusão
                                        </button>
                                    ) : (
                                        <div className="space-y-3 animate-fade-in">
                                            <input
                                                type="password"
                                                placeholder="Confirme sua senha atual"
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-lg outline-none focus:border-red-500"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleDeleteAccount} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold uppercase">Confirmar</button>
                                                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-bold uppercase">Cancelar</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
               </div>
          </div>

      </div>

      {/* --- MODAIS DE DADOS --- */}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (Ciclo) */}
      <AnimatePresence>
        {showDeleteCycleConfirm && (
            <ModalConfirmacaoExclusao
                ciclo={cicloParaExcluir}
                onClose={() => {setShowDeleteCycleConfirm(false); setCicloParaExcluir(null);}}
                onConfirm={handleConfirmPermanentDelete}
                loading={cicloActionLoading}
            />
        )}
      </AnimatePresence>

      {/* HISTÓRICO AVANÇADO */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setSelectedCycleId(null); }}
        title={selectedCycleId ? `Registros: ${activeCycleData?.nome}` : "Selecione o Ciclo"}
        maxWidth="max-w-3xl"
      >
          {/* Barra de Ferramentas do Histórico */}
          <div className="p-4 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 flex items-center gap-3">
              {selectedCycleId && (
                  <button
                    onClick={() => { setSelectedCycleId(null); setHistorySearch(''); }}
                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                      <ArrowLeft size={20} className="text-zinc-500"/>
                  </button>
              )}
              <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                  <input
                    type="text"
                    placeholder={selectedCycleId ? "Filtrar disciplina ou tópico..." : "Buscar ciclo..."}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
              </div>
              <div className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-500 flex items-center gap-2">
                  <Filter size={14}/>
                  {filteredHistory.length}
              </div>
          </div>

          {/* Conteúdo do Histórico */}
          <div className="p-4 space-y-3 min-h-[300px]">
              {filteredHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-50">
                      <LayoutDashboard size={48} className="mb-4 text-zinc-300"/>
                      <p className="text-sm font-bold text-zinc-500">Nenhum registro encontrado.</p>
                  </div>
              )}

              {!selectedCycleId ? (
                  // VISUALIZAÇÃO 1: LISTA DE CICLOS
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredHistory.map((ciclo) => (
                          <motion.button
                            layout
                            key={ciclo.id}
                            onClick={() => { setSelectedCycleId(ciclo.id); setHistorySearch(''); }}
                            className="text-left p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
                          >
                              <h4 className="font-black text-zinc-800 dark:text-white text-sm mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                                  {ciclo.nome}
                              </h4>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mb-4">
                                  Última ação: {new Date(ciclo.ultimaAtividade).toLocaleDateString()}
                              </p>

                              <div className="flex justify-between items-end">
                                  <div>
                                      <span className="block text-xs text-zinc-500">Tempo Total</span>
                                      <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                                          {formatTime(ciclo.totalMinutos)}
                                      </span>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-xs text-zinc-500">Registros</span>
                                      <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                                          {ciclo.registros.length}
                                      </span>
                                  </div>
                              </div>
                          </motion.button>
                      ))}
                  </div>
              ) : (
                  // VISUALIZAÇÃO 2: DETALHES DO CICLO
                  <div className="space-y-2">
                      {filteredHistory.map((reg) => (
                          <motion.div layout key={reg.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                      <CheckSquare size={18} />
                                  </div>
                                  <div>
                                      <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{reg.disciplinaNome}</p>
                                      {reg.topicoNome && <p className="text-xs text-zinc-500 italic">{reg.topicoNome}</p>}
                                      <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wide mt-0.5">
                                          {new Date(reg.data).toLocaleDateString()} • {reg.tipoEstudo || 'Estudo'}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="text-right">
                                      <span className="block font-black text-zinc-800 dark:text-white text-sm">
                                          {formatTime(reg.tempoEstudadoMinutos)}
                                      </span>
                                      {reg.questoesFeitas > 0 && (
                                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                                              {reg.acertos}/{reg.questoesFeitas}
                                          </span>
                                      )}
                                  </div>
                                  <button onClick={() => onDeleteRegistro(reg.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </motion.div>
                      ))}
                  </div>
              )}
          </div>
      </Modal>

      {/* ARQUIVOS */}
      <Modal isOpen={showArchivesModal} onClose={() => setShowArchivesModal(false)} title="Arquivo Morto">
          {ciclosArquivados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50">
                  <Archive size={48} className="mb-4 text-zinc-300"/>
                  <p className="text-sm font-bold text-zinc-500">Nenhum ciclo arquivado.</p>
              </div>
          ) : (
              <div className="space-y-3 p-2">
                  {ciclosArquivados.map((ciclo) => (
                      <div key={ciclo.id} className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-lg">
                                  <Archive size={18}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{ciclo.nome}</h4>
                                  <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-bold">Arquivado</p>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              {/* Botão de Restaurar */}
                              <button
                                onClick={() => handleUnarchive(ciclo.id)}
                                className="px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2"
                              >
                                  <ArchiveRestore size={14}/> Restaurar
                              </button>
                              {/* Botão de Excluir Permanente (Chama o handler que abre o modal) */}
                              <button
                                onClick={() => handleDeletePermanent(ciclo)}
                                disabled={cicloActionLoading}
                                className="p-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2"
                                title="Excluir Permanentemente"
                              >
                                  <Trash2 size={16}/>
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </Modal>

    </div>
  );
}

export default ProfilePage;