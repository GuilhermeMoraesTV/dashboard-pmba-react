import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth, storage } from '../../firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  X, Loader2, Megaphone, Zap, AlertTriangle, Bell, History, Layout,
  Palette, ImageIcon, Upload, Trash, Check, Smartphone, Monitor, Power, Trash2,
  Images, ChevronLeft, ChevronRight, Type
} from 'lucide-react';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

// --- UTILITÁRIOS ---
const formatTimeAgo = (date) => {
  if (!date) return '-';
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// --- MODAL EXPANDIDO ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useBodyScrollLock(isOpen, { fixed: false });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-100 dark:bg-zinc-900 w-full h-full md:w-[95%] md:max-w-6xl md:h-[85vh] md:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 shadow-sm z-50">
          <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
            {title} <span className="text-red-600 hidden md:inline">.</span>
          </h3>
          <button onClick={onClose} className="p-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-full transition-colors text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-zinc-50 dark:bg-black/20">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const HeaderBroadcast = ({ isOpen, onClose, segmentDraft = null }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('comunicado');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [previewMode, setPreviewMode] = useState('mobile');
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [broadcastToDelete, setBroadcastToDelete] = useState(null);

  // Estados de Imagem (Carrossel)
  const [images, setImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);

  // Temas para SELEÇÃO (Admin vê colorido para diferenciar)
  const themesSelection = {
    comunicado: { bgClass: 'bg-zinc-100', label: 'Padrão', icon: Megaphone },
    atualizacao: { bgClass: 'bg-blue-50', label: 'Feature', icon: Zap },
    aviso: { bgClass: 'bg-amber-50', label: 'Alerta', icon: AlertTriangle },
    urgente: { bgClass: 'bg-red-50', label: 'Urgente', icon: Bell }
  };

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'system_broadcasts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date()
      })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (segmentDraft) {
      setSelectedSegment(segmentDraft);
      setActiveTab('create');
    }
  }, [segmentDraft]);

  // Handlers de Imagem (Multi-upload)
  const handleImageChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newImages = newFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (previewIndex >= index && previewIndex > 0) {
        setPreviewIndex(previewIndex - 1);
    }
  };

  // Enviar Broadcast
  const handleSend = async () => {
    if (!message.trim() && images.length === 0) return;
    setSending(true);
    try {
      const user = auth.currentUser;
      const targetUserIds = !isTestMode && selectedSegment?.targetUserIds?.length
        ? selectedSegment.targetUserIds
        : null;
      let imageUrls = [];

      if (images.length > 0) {
        const uploadPromises = images.map(async (img) => {
            const storageRef = ref(storage, `broadcasts/${Date.now()}_${img.file.name}`);
            await uploadBytes(storageRef, img.file);
            return getDownloadURL(storageRef);
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      await addDoc(collection(db, 'system_broadcasts'), {
        message: imageUrls.length > 0 ? null : message,
        category,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
        timestamp: serverTimestamp(),
        active: true,
        type: 'admin_push',
        targetUid: isTestMode && user ? user.uid : null,
        targetUserIds,
        audienceMode: isTestMode ? 'test' : targetUserIds?.length ? 'segment' : 'all',
        audienceCount: isTestMode ? 1 : targetUserIds?.length || null,
        segmentId: !isTestMode ? selectedSegment?.id || null : null,
        segmentLabel: !isTestMode ? selectedSegment?.label || null : null,
        segmentFilters: !isTestMode ? selectedSegment?.filtersSnapshot || null : null,
      });

      setMessage('');
      setCategory('comunicado');
      setImages([]);
      setPreviewIndex(0);
      setSelectedSegment(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab('history');
      setIsTestMode(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try { await updateDoc(doc(db, 'system_broadcasts', id), { active: !currentStatus }); } catch (error) { console.error(error); }
  };

  const handleDeleteBroadcast = async (id) => {
    setBroadcastToDelete(id);
  };

  const confirmDeleteBroadcast = async () => {
    if (!broadcastToDelete) return;
    await deleteDoc(doc(db, 'system_broadcasts', broadcastToDelete));
    setBroadcastToDelete(null);
  };

  // --- LÓGICA DE VISUALIZAÇÃO DO PREVIEW (Igual ao Receiver) ---
  const getPreviewTheme = (type) => {
      // Estilo UNIFICADO VERMELHO SUTIL para o preview
      const redThemeBase = {
          bgClass: 'bg-gradient-to-br from-red-50 to-red-100 border-r border-red-100/50',
          titleColor: 'text-red-700',
          iconColor: 'text-red-600',
          barColor: 'bg-red-600',
          button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
      };

      const styles = {
          atualizacao: { ...redThemeBase, title: 'ATUALIZAÇÃO', icon: Zap },
          urgente: { ...redThemeBase, title: 'URGENTE', icon: Bell },
          aviso: { ...redThemeBase, title: 'ATENÇÃO', icon: AlertTriangle },
          comunicado: { ...redThemeBase, title: 'COMUNICADO', icon: Megaphone }
      };
      return styles[type] || styles.comunicado;
  };

  const previewTheme = getPreviewTheme(category);

  if (!isOpen) return null;

  return (
    <>
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Estúdio de Transmissão">
      <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 w-full">

        {/* --- ABAS --- */}
        <div className="flex items-center gap-6 px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <button onClick={() => setActiveTab('create')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide pb-1 border-b-2 transition-all ${activeTab === 'create' ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-400'}`}>
            <Layout size={14} /> Estúdio
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide pb-1 border-b-2 transition-all ${activeTab === 'history' ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-400'}`}>
            <History size={14} /> Histórico
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

            {/* --- EDITOR (ESQUERDA) --- */}
            <div className="flex-1 p-6 lg:p-10 overflow-y-auto space-y-8 custom-scrollbar bg-white dark:bg-zinc-950">

              {/* Seletor de Categoria (Só se não tiver imagens) */}
              {images.length === 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                    <Palette size={12} /> Categoria Visual
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(themesSelection).map(([key, theme]) => (
                      <button key={key} onClick={() => setCategory(key)} className={`relative overflow-hidden rounded-xl p-3 border-2 transition-all flex flex-col items-center gap-2 group ${category === key ? `border-red-600 bg-red-50 dark:bg-red-900/10` : 'border-transparent bg-zinc-100 dark:bg-zinc-900 opacity-60 hover:opacity-100'}`}>
                        <div className={`w-8 h-8 rounded-full ${theme.bgClass} shadow-md mb-1 flex items-center justify-center text-zinc-700`}>
                          <theme.icon size={14} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-300">{theme.label}</span>
                        {category === key && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload de Imagens */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                  <Images size={12} /> Imagens / Slides ({images.length})
                </label>

                <div
                    onClick={() => fileInputRef.current.click()}
                    className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
                >
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Upload size={20} className="text-zinc-400 group-hover:text-red-500" />
                    </div>
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-red-600">
                        {images.length > 0 ? "Adicionar mais imagens" : "Enviar imagens"}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1">Suporta múltiplas imagens</p>
                </div>

                {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group">
                                <img src={img.preview} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleRemoveImage(idx)} className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700">
                                        <Trash size={14} />
                                    </button>
                                </div>
                                <span className="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1.5 rounded font-bold">{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" multiple className="hidden" />
              </div>

              {/* Editor de Texto */}
              {images.length === 0 && (
                <div className="space-y-3 flex-1 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex justify-between items-center">
                    <span className="flex items-center gap-2"><Type size={12} /> Mensagem</span>
                    <span className={message.length > 300 ? 'text-red-500' : 'text-zinc-400'}>{message.length} chars</span>
                  </label>
                  <div className="relative flex-1 min-h-[150px]">
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem oficial aqui..." className="w-full h-full p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm leading-relaxed dark:text-white resize-none shadow-inner transition-all" />
                  </div>
                </div>
              )}

              {selectedSegment && !isTestMode && (
                <div className="p-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/70 dark:bg-red-950/20 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Audiencia segmentada</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedSegment.label}</p>
                    </div>
                    <button onClick={() => setSelectedSegment(null)} className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:text-red-600 transition-colors">
                      Limpar
                    </button>
                  </div>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{selectedSegment.description || selectedSegment.subtitle}</p>
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-300">{selectedSegment.audienceCount || 0} usuarios receberao este broadcast.</p>
                </div>
              )}

              <div onClick={() => setIsTestMode(!isTestMode)} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isTestMode ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'}`}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isTestMode ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {isTestMode && <Check size={12} strokeWidth={4} />}
                </div>
                <div>
                    <span className={`text-xs font-bold ${isTestMode ? 'text-red-700 dark:text-red-400' : 'text-zinc-500'}`}>Modo de Teste</span>
                    <p className="text-[10px] text-zinc-400">Somente você verá este broadcast.</p>
                </div>
              </div>

              <button onClick={handleSend} disabled={(!message.trim() && images.length === 0) || sending} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95">
                {sending ? <Loader2 className="animate-spin" /> : <Megaphone />} {isTestMode ? 'Publicar Teste' : selectedSegment?.audienceCount ? `Publicar para ${selectedSegment.audienceCount}` : 'Publicar Broadcast'}
              </button>
            </div>

            {/* --- LIVE PREVIEW (DIREITA) --- */}
            <div className="flex-1 bg-zinc-950/90 border-l border-zinc-800 p-8 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-6 right-6 flex bg-zinc-900 rounded-lg p-1 shadow-sm border border-zinc-800 z-10">
                <button onClick={() => setPreviewMode('mobile')} className={`p-2 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}><Smartphone size={16} /></button>
                <button onClick={() => setPreviewMode('desktop')} className={`p-2 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}><Monitor size={16} /></button>
              </div>

              <h3 className="absolute top-8 left-8 text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Preview (Usuário)
              </h3>

              {/* CONTAINER DO MOCKUP */}
              <div className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center z-0 ${previewMode === 'mobile' ? 'w-[320px] scale-100' : 'w-[500px] scale-90'}`}>

                {images.length > 0 ? (
                    // === PREVIEW: MODO IMAGEM/CARROSSEL (Puro, sem botão Ciente) ===
                    <div className="relative w-full flex flex-col items-center">
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center w-full aspect-[9/16]">

                            {/* Botão Fechar Simulado */}
                            <div className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full border border-white/10 z-50">
                                <X size={14} />
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={previewIndex}
                                    src={images[previewIndex].preview}
                                    alt="Preview"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
                                />
                            </AnimatePresence>

                            {/* Controles de Navegação */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setPreviewIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm z-20"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setPreviewIndex(prev => (prev + 1) % images.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm z-20"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                    <div className="absolute bottom-4 w-full flex justify-center gap-1.5 z-20">
                                        {images.map((_, i) => (
                                            <div key={i} className={`h-1.5 rounded-full transition-all ${i === previewIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    // === PREVIEW: MODO TEXTO (Novo Design Branco + Vermelho Sutil) ===
                    <div className={`
                        relative w-full overflow-hidden bg-white
                        rounded-3xl shadow-2xl border border-zinc-200
                        flex flex-col ${previewMode === 'desktop' ? 'md:flex-row' : ''}
                    `}>
                        {/* Lado Esquerdo (Visual) */}
                        <div className={`
                            relative overflow-hidden flex flex-col items-center justify-center shrink-0
                            w-full ${previewMode === 'desktop' ? 'md:w-5/12' : ''}
                            py-10
                            ${previewTheme.bgClass}
                        `}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none mix-blend-multiply">
                                <img src="/logoModoQAP.png" alt="Watermark" className="w-[140%] h-[140%] object-contain scale-150 grayscale" />
                            </div>
                            <div className="relative z-10 w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 flex items-center justify-center shadow-lg mb-3">
                                {React.createElement(previewTheme.icon, { size: 32, className: previewTheme.iconColor })}
                            </div>
                            <h2 className={`relative z-10 text-xl font-black ${previewTheme.titleColor} uppercase tracking-widest drop-shadow-sm`}>{previewTheme.title}</h2>
                        </div>

                        {/* Lado Direito (Texto) */}
                        <div className={`flex flex-col relative bg-white overflow-hidden w-full ${previewMode === 'desktop' ? 'md:w-7/12' : ''}`}>
                            <div className="absolute top-3 right-3 p-1.5 text-zinc-400 bg-zinc-100 rounded-full">
                                <X size={14} />
                            </div>

                            <div className="flex-1 p-6 min-h-[150px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-1 h-5 rounded-full ${previewTheme.barColor}`}></div>
                                    <h3 className={`text-sm font-bold ${previewTheme.titleColor} uppercase`}>{previewTheme.title}</h3>
                                </div>
                                <p className="text-xs md:text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed font-medium">
                                    {message || "O conteúdo da sua mensagem aparecerá aqui..."}
                                </p>
                            </div>

                            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex flex-col items-center">
                                <div className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-md flex items-center gap-2 mb-2 ${previewTheme.button}`}>
                                    <Check size={12} strokeWidth={3} /> Ciente
                                </div>
                                <div className="flex items-center justify-center gap-2 opacity-40">
                                    <img src="/logoModoQAP.png" className="h-3 w-auto object-contain grayscale" alt="Logo" />
                                    <div className="h-2 w-px bg-zinc-300"></div>
                                    <h1 className="text-red-600 font-black tracking-widest uppercase text-[8px]">MODOQAP</h1>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 bg-white dark:bg-zinc-950">
            <div className="max-w-4xl mx-auto w-full space-y-4">
              {history.length === 0 && <div className="text-center py-20 opacity-50"><p>Nenhum broadcast enviado.</p></div>}
              {history.map((msg) => (
                <div key={msg.id} className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-between gap-4 bg-white dark:bg-zinc-900 items-center hover:shadow-md transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{msg.category}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${msg.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{msg.active ? 'Ativo' : 'Inativo'}</span>

                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
                                <Images size={10}/> {msg.imageUrls.length} Slides
                            </span>
                        )}
                        {!msg.imageUrls && msg.imageUrl && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
                                <ImageIcon size={10}/> 1 Imagem
                            </span>
                        )}

                        {msg.targetUid && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200">Teste</span>}
                        {msg.segmentLabel && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">{msg.segmentLabel}</span>}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-1 truncate">{msg.message || "(Conteúdo Visual)"}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">{formatTimeAgo(msg.timestamp)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleActive(msg.id, msg.active)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200"><Power size={16}/></button>
                    <button onClick={() => handleDeleteBroadcast(msg.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ExpandedModal>
    <ConfirmModal
      isOpen={!!broadcastToDelete}
      onClose={() => setBroadcastToDelete(null)}
      onConfirm={confirmDeleteBroadcast}
      title="Excluir broadcast?"
      message="Essa mensagem sera removida permanentemente do historico de comunicados."
      confirmText="Excluir"
      isDestructive
    />
    </>
  );
};

export default HeaderBroadcast;
