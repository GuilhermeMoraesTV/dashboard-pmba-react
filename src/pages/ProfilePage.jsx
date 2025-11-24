import React, { useState, useMemo, useEffect } from 'react';
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
  doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AnimatePresence, motion } from 'framer-motion';

import {
  User, Edit, Save, X, BarChart2, Archive, Loader2, Upload, Trash2,
  ArchiveRestore, Calendar, Clock, CheckSquare, History, Shield, Mail, Key, AlertOctagon
} from 'lucide-react';

// --- SUB-COMPONENTE: Modal Genérico ---
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
            >
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

function ProfilePage({ user, allRegistrosEstudo = [], onDeleteRegistro }) {
  // --- Estados ---
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estados de Foto
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Modais
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showArchivesModal, setShowArchivesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Dados
  const [ciclosArquivados, setCiclosArquivados] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);

  useEffect(() => {
    setPhotoPreview(user?.photoURL);
  }, [user?.photoURL]);

  // Carrega estatísticas e Arquivados
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
        const registrosSnap = await getDocs(registrosRef);
        setTotalRegistros(registrosSnap.size);

        const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
        const qArquivados = query(ciclosRef, where('arquivado', '==', true), orderBy('dataCriacao', 'desc'));
        const unsubscribe = onSnapshot(qArquivados, (snapshot) => {
          setCiclosArquivados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    loadData();
  }, [user]);

  // --- Ações de Usuário ---
  const handleUpdatePhoto = async () => {
    if (!photo) return;
    setPhotoLoading(true);
    try {
      const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
      const snapshot = await uploadBytes(storageRef, photo);
      const photoURL = await getDownloadURL(snapshot.ref);
      await updateProfile(auth.currentUser, { photoURL });
      await updateDoc(doc(db, 'users', user.uid), { photoURL });
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso.' });
      setPhoto(null);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao atualizar foto.' });
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
        console.error(error);
      setMessage({ type: 'error', text: 'Erro ao atualizar e-mail.' });
    }
  };

  const handleSendPasswordReset = async () => {
    setSenhaLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: `Email de redefinição enviado para ${user.email}.` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao enviar email.' });
    } finally {
      setSenhaLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
      // Lógica de delete simplificada para exemplo
      if(!deletePassword) return;
      try {
          const credential = EmailAuthProvider.credential(user.email, deletePassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await deleteUser(auth.currentUser);
      } catch (e) {
          setMessage({type: 'error', text: 'Senha incorreta ou erro ao deletar.'});
      }
  };

  const handleUnarchive = async (id) => {
      await updateDoc(doc(db, 'users', user.uid, 'ciclos', id), { arquivado: false });
  };

  const formatTime = (min) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h ${m}m`;
  };

  if (!user) return <div className="p-8 text-center">Carregando perfil...</div>;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">

      {/* --- BANNER DO PERFIL (Estilo Ficha Técnica) --- */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-zinc-900 to-zinc-800 relative">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          </div>

          <div className="px-8 pb-8 flex flex-col md:flex-row items-end md:items-center -mt-12 gap-6">
              {/* Avatar com Upload */}
              <div className="relative group">
                  <div className="w-28 h-28 rounded-2xl border-4 border-white dark:border-zinc-900 overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-lg">
                      {photoPreview ? (
                          <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400"><User size={40}/></div>
                      )}
                  </div>
                  <label className="absolute bottom-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
                      <Upload size={16} />
                      <input type="file" accept="image/*" onChange={(e) => {
                          if(e.target.files?.[0]) {
                              setPhoto(e.target.files[0]);
                              setPhotoPreview(URL.createObjectURL(e.target.files[0]));
                          }
                      }} className="hidden" />
                  </label>
              </div>

              <div className="flex-1 mb-2">
                  <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">{user.displayName || 'Operador'}</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
                      <Mail size={14} /> {user.email}
                  </p>
              </div>

              {/* Botão Salvar Foto (Só aparece se mudou) */}
              {photo && (
                  <button
                    onClick={handleUpdatePhoto}
                    disabled={photoLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
                  >
                      {photoLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar Foto
                  </button>
              )}
          </div>
      </div>

      {/* Mensagens de Feedback */}
      <AnimatePresence>
        {message.text && (
            <motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>
                {message.text}
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- GRID DE AÇÕES E STATUS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Coluna Esquerda: Stats Rápidos */}
          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Estatísticas de Carreira</h3>
                  <div className="space-y-4">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                              <BarChart2 size={24} />
                          </div>
                          <div>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white">{totalRegistros}</p>
                              <p className="text-xs text-zinc-500">Missões Registradas</p>
                          </div>
                      </div>
                      <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                              <Calendar size={24} />
                          </div>
                          <div>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white">
                                  {Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24))}
                              </p>
                              <p className="text-xs text-zinc-500">Dias em Operação</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Botões de Acesso a Modais */}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="w-full group flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-500/50 hover:shadow-lg transition-all"
              >
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 group-hover:bg-indigo-500 group-hover:text-white text-zinc-500 rounded-xl transition-colors">
                          <History size={24} />
                      </div>
                      <div className="text-left">
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-100">Histórico Completo</h4>
                          <p className="text-xs text-zinc-500">Acesse todos os seus registros</p>
                      </div>
                  </div>
                  <div className="text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">➜</div>
              </button>

              <button
                onClick={() => setShowArchivesModal(true)}
                className="w-full group flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/50 hover:shadow-lg transition-all"
              >
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 group-hover:bg-amber-500 group-hover:text-white text-zinc-500 rounded-xl transition-colors">
                          <Archive size={24} />
                      </div>
                      <div className="text-left">
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-100">Arquivo Morto</h4>
                          <p className="text-xs text-zinc-500">{ciclosArquivados.length} ciclos arquivados</p>
                      </div>
                  </div>
                  <div className="text-zinc-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">➜</div>
              </button>
          </div>

          {/* Coluna Direita: Segurança e Dados */}
          <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Shield size={14} /> Segurança & Acesso
              </h3>

              <div className="space-y-8">
                  {/* Alterar Email */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pb-6 border-b border-zinc-100 dark:border-zinc-800">
                      <div>
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-200">Endereço de E-mail</h4>
                          <p className="text-sm text-zinc-500">Utilizado para login e recuperação de conta.</p>
                      </div>
                      {!isEditingEmail ? (
                          <div className="flex items-center gap-3">
                              <span className="text-sm font-mono bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded text-zinc-600 dark:text-zinc-300">{user.email}</span>
                              <button onClick={() => setIsEditingEmail(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-500">Editar</button>
                          </div>
                      ) : (
                          <div className="flex items-center gap-2 w-full md:w-auto">
                              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm" />
                              <button onClick={handleUpdateEmail} className="p-2 bg-indigo-600 text-white rounded-lg"><Save size={16}/></button>
                              <button onClick={() => setIsEditingEmail(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"><X size={16}/></button>
                          </div>
                      )}
                  </div>

                  {/* Redefinir Senha */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pb-6 border-b border-zinc-100 dark:border-zinc-800">
                      <div>
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-200">Senha de Acesso</h4>
                          <p className="text-sm text-zinc-500">Recomendamos atualizar periodicamente.</p>
                      </div>
                      <button
                        onClick={handleSendPasswordReset}
                        disabled={senhaLoading}
                        className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                          <Key size={16} /> {senhaLoading ? 'Enviando...' : 'Redefinir Senha'}
                      </button>
                  </div>

                  {/* Zona de Perigo */}
                  <div className="pt-2">
                      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                          <h4 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2 mb-2">
                              <AlertOctagon size={18} /> Zona de Perigo
                          </h4>
                          <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                              A exclusão da conta é irreversível e apagará todos os seus dados.
                          </p>
                          {!showDeleteConfirm ? (
                              <button onClick={() => setShowDeleteConfirm(true)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors">
                                  Excluir Conta
                              </button>
                          ) : (
                              <div className="flex gap-2 items-center">
                                  <input
                                    type="password"
                                    placeholder="Confirme sua senha"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    className="px-3 py-2 text-sm border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-950 rounded-lg"
                                  />
                                  <button onClick={handleDeleteAccount} className="text-xs font-bold text-white bg-red-600 px-4 py-2 rounded-lg">Confirmar</button>
                                  <button onClick={() => setShowDeleteConfirm(false)} className="text-xs font-bold text-zinc-600 bg-zinc-200 px-3 py-2 rounded-lg">Cancelar</button>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal de Histórico */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Histórico de Operações">
          {allRegistrosEstudo.length === 0 ? (
              <p className="text-center text-zinc-500 py-10">Nenhum registro encontrado.</p>
          ) : (
              <div className="space-y-2">
                  {allRegistrosEstudo.map((reg) => (
                      <div key={reg.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-4">
                              <div className="p-2 bg-white dark:bg-zinc-800 rounded-md shadow-sm text-zinc-400">
                                  <CheckSquare size={18} />
                              </div>
                              <div>
                                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{reg.disciplinaNome}</p>
                                  <p className="text-xs text-zinc-500">{new Date(reg.data).toLocaleDateString()} • {reg.tipoEstudo || 'Estudo'}</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <span className="block font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatTime(reg.tempoEstudadoMinutos)}
                              </span>
                              {reg.questoesFeitas > 0 && (
                                  <span className="text-xs text-emerald-500 font-medium">
                                      {reg.acertos}/{reg.questoesFeitas} acertos
                                  </span>
                              )}
                          </div>
                          <button onClick={() => onDeleteRegistro(reg.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </Modal>

      {/* Modal de Arquivos */}
      <Modal isOpen={showArchivesModal} onClose={() => setShowArchivesModal(false)} title="Ciclos Arquivados">
          {ciclosArquivados.length === 0 ? (
              <p className="text-center text-zinc-500 py-10">Nenhum ciclo arquivado.</p>
          ) : (
              <div className="space-y-3">
                  {ciclosArquivados.map((ciclo) => (
                      <div key={ciclo.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl flex justify-between items-center">
                          <div>
                              <h4 className="font-bold text-zinc-800 dark:text-zinc-200">{ciclo.nome}</h4>
                              <p className="text-xs text-zinc-500">Arquivado recentemente</p>
                          </div>
                          <button
                            onClick={() => handleUnarchive(ciclo.id)}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                              Desarquivar
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </Modal>

    </div>
  );
}

export default ProfilePage;