// src/pages/ProfilePage.jsx
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
  doc, updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import {
  User,
  Edit,
  Save,
  X,
  BarChart2,
  Archive,
  Loader2,
  Upload,
  Trash2,
  ArchiveRestore,
  FilterIcon,
  Calendar,
  Clock,
  CheckSquare
} from 'lucide-react';

// Placeholder para avatar
const IconUserAvatar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary-color">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

function ProfilePage({ user, allRegistrosEstudo = [], onDeleteRegistro }) {
  // --- Estados de Abas ---
  const [abaAtiva, setAbaAtiva] = useState('info');

  // --- Estados de E-mail ---
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');

  // --- Estados de Senha ---
  const [senhaMessage, setSenhaMessage] = useState({ type: '', text: '' });
  const [senhaLoading, setSenhaLoading] = useState(false);

  // --- Estados de Exclusão ---
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Estados de Foto ---
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // --- Estados Gerais ---
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // --- Estados de Estatísticas ---
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [ciclosArquivados, setCiclosArquivados] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // --- Estados do Histórico ---
  const [registros, setRegistros] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [cicloFiltro, setCicloFiltro] = useState('');
  const [editando, setEditando] = useState(null);

  // Atualizar preview da foto
  useEffect(() => {
    setPhotoPreview(user?.photoURL);
  }, [user?.photoURL]);

  // Carrega estatísticas
  useEffect(() => {
    if (!user) return;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
        const registrosSnap = await getDocs(registrosRef);
        setTotalRegistros(registrosSnap.size);

        const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
        const qArquivados = query(ciclosRef, where('arquivado', '==', true), orderBy('dataCriacao', 'desc'));

        const unsubscribe = onSnapshot(qArquivados, (snapshot) => {
          const ciclos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCiclosArquivados(ciclos);
          setLoadingStats(false);
        });
        return () => unsubscribe();

      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
        setLoadingStats(false);
      }
    };
    loadStats();
  }, [user]);

  // Buscar ciclos para o histórico
  useEffect(() => {
    if (!user) return;

    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const unsubscribe = onSnapshot(ciclosRef, (snapshot) => {
      const ciclosData = snapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome
      }));
      setCiclos(ciclosData);
    });

    return () => unsubscribe();
  }, [user]);

  // Atualizar registros do histórico
  useEffect(() => {
    setRegistros(allRegistrosEstudo || []);
  }, [allRegistrosEstudo]);

  // Filtrar registros
  const registrosFiltrados = cicloFiltro
    ? registros.filter(r => r.cicloId === cicloFiltro)
    : registros;

  // Reautenticação
  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  // --- Lógica de Foto ---
  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoError('');
    }
  };

  const handleUpdatePhoto = async () => {
    if (!photo) {
      setPhotoError('Nenhuma foto selecionada.');
      return;
    }
    setPhotoLoading(true);
    setPhotoError('');
    setMessage({ type: '', text: '' });

    try {
      const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
      const snapshot = await uploadBytes(storageRef, photo);
      const photoURL = await getDownloadURL(snapshot.ref);

      await updateProfile(auth.currentUser, { photoURL: photoURL });

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { photoURL: photoURL });

      setMessage({ type: 'success', text: '✅ Foto de perfil atualizada!' });
      setPhoto(null);

    } catch (error) {
      console.error("Erro ao atualizar foto:", error);
      setPhotoError('Falha ao atualizar a foto. Tente novamente.');
    } finally {
      setPhotoLoading(false);
    }
  };

  // Atualizar Email
  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user.email) {
      setMessage({ type: 'error', text: 'Digite um novo e-mail válido.' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      setMessage({
        type: 'success',
        text: `✅ Sucesso! Um link de verificação foi enviado para ${newEmail}. Clique nele para confirmar a alteração.`
      });
      setIsEditingEmail(false);
    } catch (error) {
      console.error("Erro ao atualizar e-mail:", error);
      if (error.code === 'auth/email-already-in-use') {
        setMessage({ type: 'error', text: 'Este e-mail já está em uso.' });
      } else if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Esta operação é sensível. Por favor, faça logout e login novamente antes de tentar.' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao enviar link de verificação. Tente novamente.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Redefinir Senha
  const handleSendPasswordReset = async () => {
    if (!auth.currentUser) return;
    setSenhaLoading(true);
    setMessage({ type: '', text: '' });
    setSenhaMessage({ type: '', text: '' });
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSenhaMessage({
        type: 'success',
        text: `✅ Link de redefinição enviado para ${user.email}. Verifique sua caixa de entrada.`
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      setSenhaMessage({ type: 'error', text: 'Erro ao enviar e-mail. Tente novamente.' });
    }
    setSenhaLoading(false);
  };

  // Deletar a conta
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Digite sua senha para confirmar a exclusão.' });
      return;
    }
    setDeleteLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await reauthenticate(deletePassword);
      await deleteUser(auth.currentUser);
    } catch (error) {
      console.error("Erro ao deletar conta:", error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Senha incorreta. A conta não foi deletada.' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao deletar conta. Tente novamente.' });
      }
      setDeleteLoading(false);
    }
  };

  // Funções para Ciclos Arquivados
  const handleUnarchiveCycle = async (cicloId) => {
    if (!user) return;
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    try {
      await updateDoc(cicloRef, { arquivado: false });
      setMessage({ type: 'success', text: '✅ Ciclo desarquivado com sucesso!' });
    } catch (error) {
      console.error("Erro ao desarquivar ciclo:", error);
      setMessage({ type: 'error', text: 'Não foi possível desarquivar o ciclo.' });
    }
  };

  const handleDeleteCycle = async (cicloId) => {
    if (!user) return;
    if (!window.confirm("ATENÇÃO: Excluir um ciclo é permanente. Deseja continuar?")) {
      return;
    }

    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    try {
      await deleteDoc(cicloRef);
      setMessage({ type: 'success', text: '✅ Ciclo excluído com sucesso.' });
    } catch (error) {
      console.error("Erro ao excluir ciclo:", error);
      setMessage({ type: 'error', text: 'Não foi possível excluir o ciclo.' });
    }
  };

  // --- Lógica do Histórico ---
  const formatarHoras = (minutos) => {
    if (!minutos || minutos < 0) return '00h 00m';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  };

  const handleSalvarEdicao = async () => {
    if (!editando || !user) return;

    try {
      const registroRef = doc(
        db,
        'users',
        user.uid,
        'registrosEstudo',
        editando.id
      );

      await updateDoc(registroRef, {
        tempoEstudadoMinutos: Number(editando.tempoEstudadoMinutos) || 0,
        questoesFeitas: Number(editando.questoesFeitas) || 0,
        acertos: Number(editando.acertos) || 0,
        disciplinaNome: editando.disciplinaNome || '',
      });

      setEditando(null);
      alert('✅ Registro atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('❌ Erro ao atualizar o registro');
    }
  };

  // Estatísticas calculadas
  const userStats = useMemo(() => {
    const accountAge = user?.metadata?.creationTime
      ? Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      accountAge,
      totalRegistros,
      ciclosArquivados: ciclosArquivados.length,
    };
  }, [user, totalRegistros, ciclosArquivados]);


  if (!user) {
    return <div className="p-6 text-center text-text-color">Carregando...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Cabeçalho com Foto e Nome */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0 relative">
            <div className="w-24 h-24 rounded-full bg-background-color dark:bg-dark-background-color flex items-center justify-center overflow-hidden border-2 border-border-color dark:border-dark-border-color">
              {photoPreview ? (
                <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <IconUserAvatar />
              )}
            </div>
            <label
              htmlFor="profile-photo-upload"
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary-color text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-all"
              title="Trocar foto"
            >
              <Upload size={16} />
              <input
                id="profile-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex-grow text-center sm:text-left">
            <h1 className="text-3xl font-bold text-heading-color dark:text-dark-heading-color">
              {user.displayName || 'Área do Estudante'}
            </h1>
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
              Gerencie suas informações pessoais e acompanhe seu progresso
            </p>
            {photo && (
              <div className="mt-2 flex items-center gap-2 justify-center sm:justify-start">
                <button
                  onClick={handleUpdatePhoto}
                  disabled={photoLoading}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {photoLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span className="ml-1">Salvar Foto</span>
                </button>
                <button
                  onClick={() => { setPhoto(null); setPhotoPreview(user.photoURL); }}
                  className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {photoError && <p className="text-sm text-red-500 mt-1">{photoError}</p>}
          </div>
        </div>
      </div>

      {/* Mensagens Globais */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* Abas */}
      <div className="border-b-2 border-border-color dark:border-dark-border-color">
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setAbaAtiva('info')}
            className={`px-6 py-3 font-semibold transition-all border-b-2 -mb-0.5 ${
              abaAtiva === 'info'
                ? 'border-primary-color text-primary-color'
                : 'border-transparent text-subtle-text-color hover:text-text-color'
            }`}
          >
            👤 Informações
          </button>
          <button
            onClick={() => setAbaAtiva('historico')}
            className={`px-6 py-3 font-semibold transition-all border-b-2 -mb-0.5 ${
              abaAtiva === 'historico'
                ? 'border-primary-color text-primary-color'
                : 'border-transparent text-subtle-text-color hover:text-text-color'
            }`}
          >
            📋 Histórico de Registros
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {abaAtiva === 'info' ? (
        // ===== ABA DE INFORMAÇÕES =====
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda - Informações */}
          <div className="lg:col-span-2 space-y-6">

            {/* Segurança da Conta */}
            <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
              <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
                🔒 Segurança da Conta
              </h2>

              {/* Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-2">
                  E-mail
                </label>
                {!isEditingEmail ? (
                  <div className="flex items-center justify-between p-3 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color">
                    <span className="text-text-color dark:text-dark-text-color">{user.email}</span>
                    <button
                      onClick={() => {
                        setIsEditingEmail(true);
                        setMessage({ type: '', text: '' });
                        setSenhaMessage({ type: '', text: '' });
                      }}
                      className="text-primary-color hover:text-primary-hover font-semibold flex items-center text-sm"
                    >
                      <Edit size={14} className="mr-1" /> Editar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Novo e-mail"
                      className="w-full p-3 rounded-lg bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleUpdateEmail}
                        disabled={loading}
                        className="px-4 py-2 bg-primary-color text-white rounded-lg font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        <span className="ml-1">Enviar Verificação</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingEmail(false);
                          setNewEmail(user.email);
                          setMessage({ type: '', text: '' });
                        }}
                        className="px-4 py-2 bg-gray-600 dark:bg-dark-border-color text-white dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-700 flex items-center"
                      >
                        <X size={18} /> <span className="ml-1">Cancelar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-2">
                  Senha
                </label>
                <div className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg space-y-3 border border-border-color dark:border-dark-border-color">
                  <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                    Para redefinir sua senha, um link seguro será enviado ao seu e-mail de cadastro.
                  </p>
                  {senhaMessage.text && (
                    <div className={`p-3 rounded-lg text-sm ${
                      senhaMessage.type === 'success'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {senhaMessage.text}
                    </div>
                  )}
                  <button
                    onClick={handleSendPasswordReset}
                    disabled={senhaLoading}
                    className="px-4 py-2 bg-card-background-color dark:bg-dark-card-background-color text-text-color border border-border-color dark:border-dark-border-color rounded-lg font-semibold hover:bg-border-color dark:hover:bg-dark-border-color disabled:opacity-50 flex items-center justify-center"
                  >
                    {senhaLoading && <Loader2 size={18} className="animate-spin mr-2" />}
                    {senhaLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
                  </button>
                </div>
              </div>
            </div>

            {/* Ciclos Arquivados */}
            <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
              <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 flex items-center gap-2">
                <Archive size={22} /> Ciclos Arquivados
              </h2>
              {loadingStats ? (
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color">Carregando...</p>
              ) : ciclosArquivados.length === 0 ? (
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-center py-8">
                  Nenhum ciclo arquivado ainda.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {ciclosArquivados.map(ciclo => (
                    <div key={ciclo.id} className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-text-color dark:text-dark-text-color">
                            {ciclo.nome}
                          </h3>
                          <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                            Carga: {ciclo.cargaHorariaSemanalTotal}h/semana
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            title="Desarquivar Ciclo"
                            onClick={() => handleUnarchiveCycle(ciclo.id)}
                            className="p-2 rounded-lg text-subtle-text-color hover:text-green-500 hover:bg-green-500/10 transition-colors"
                          >
                            <ArchiveRestore size={18} />
                          </button>
                          <button
                            title="Excluir Ciclo"
                            onClick={() => handleDeleteCycle(ciclo.id)}
                            className="p-2 rounded-lg text-subtle-text-color hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita - Estatísticas */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
              <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 flex items-center gap-2">
                <BarChart2 size={22} /> Suas Estatísticas
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg">
                  <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                    Conta criada há
                  </p>
                  <p className="text-2xl font-bold text-primary-color">
                    {userStats.accountAge} dias
                  </p>
                </div>
                <div className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg">
                  <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                    Total de Registros
                  </p>
                  <p className="text-2xl font-bold text-heading-color dark:text-dark-heading-color">
                    {userStats.totalRegistros}
                  </p>
                </div>
                <div className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg">
                  <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                    Ciclos Arquivados
                  </p>
                  <p className="text-2xl font-bold text-heading-color dark:text-dark-heading-color">
                    {userStats.ciclosArquivados}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        // ===== ABA DE HISTÓRICO =====
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <div className="flex items-center gap-3 mb-4">
              <FilterIcon size={20} className="text-primary-color" />
              <p className="text-sm font-semibold text-heading-color dark:text-dark-heading-color uppercase">
                Filtrar por Ciclo
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCicloFiltro('')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  cicloFiltro === ''
                    ? 'bg-primary-color text-white'
                    : 'bg-background-color dark:bg-dark-background-color text-text-color hover:bg-border-color'
                }`}
              >
                Todos ({registros.length})
              </button>
              {ciclos.map(ciclo => (
                <button
                  key={ciclo.id}
                  onClick={() => setCicloFiltro(ciclo.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    cicloFiltro === ciclo.id
                      ? 'bg-primary-color text-white'
                      : 'bg-background-color dark:bg-dark-background-color text-text-color hover:bg-border-color'
                  }`}
                >
                  {ciclo.nome} ({registros.filter(r => r.cicloId === ciclo.id).length})
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Registros */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color overflow-x-auto">
            {registrosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-subtle-text-color mb-4 opacity-50" />
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
                  Nenhum registro neste filtro
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border-color dark:border-dark-border-color">
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color">📅 Data</th>
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color">📚 Disciplina</th>
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color">⏱️ Tempo</th>
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color">❓ Questões</th>
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color">✅ Acertos</th>
                    <th className="p-3 text-xs uppercase font-bold text-subtle-text-color text-right">⚙️ Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color dark:divide-dark-border-color">
                  {registrosFiltrados.map((registro) => (
                    <tr
                      key={registro.id}
                      className="hover:bg-background-color dark:hover:bg-dark-background-color transition-colors"
                    >
                      <td className="p-3 font-semibold text-text-color">
                        {new Date(registro.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-heading-color dark:text-dark-heading-color font-semibold">
                        {registro.disciplinaNome || 'N/A'}
                      </td>
                      <td className="p-3 text-primary-color font-semibold">
                        {formatarHoras(registro.tempoEstudadoMinutos || 0)}
                      </td>
                      <td className="p-3 text-text-color">
                        {registro.questoesFeitas || 0}
                      </td>
                      <td className="p-3">
                        {registro.questoesFeitas > 0 ? (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-success-color/10 text-success-color">
                            {registro.acertos || 0}/{registro.questoesFeitas || 0}
                          </span>
                        ) : (
                          <span className="text-subtle-text-color">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => setEditando({ ...registro })}
                          className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => onDeleteRegistro(registro.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal de Edição */}
          {editando && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl p-8 w-full max-w-md border border-border-color dark:border-dark-border-color">
                <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
                  ✏️ Editar Registro
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-color mb-2">Data</label>
                    <input
                      type="date"
                      value={editando.data}
                      onChange={(e) => setEditando({ ...editando, data: e.target.value })}
                      className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-color mb-2">Disciplina</label>
                    <input
                      type="text"
                      value={editando.disciplinaNome}
                      onChange={(e) => setEditando({ ...editando, disciplinaNome: e.target.value })}
                      className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-text-color mb-2">Tempo (min)</label>
                      <input
                        type="number"
                        value={editando.tempoEstudadoMinutos}
                        onChange={(e) => setEditando({ ...editando, tempoEstudadoMinutos: e.target.value })}
                        className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-color mb-2">Questões</label>
                      <input
                        type="number"
                        value={editando.questoesFeitas}
                        onChange={(e) => setEditando({ ...editando, questoesFeitas: e.target.value })}
                        className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-color mb-2">Acertos</label>
                      <input
                        type="number"
                        value={editando.acertos}
                        onChange={(e) => setEditando({ ...editando, acertos: e.target.value })}
                        className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary-color text-text-color"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleSalvarEdicao}
                    className="flex-1 px-6 py-3 bg-primary-color hover:bg-primary-hover text-white font-bold rounded-lg transition-all"
                  >
                    💾 Salvar
                  </button>
                  <button
                    onClick={() => setEditando(null)}
                    className="flex-1 px-6 py-3 bg-border-color dark:bg-dark-border-color text-text-color hover:bg-border-color/80 font-bold rounded-lg transition-all"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zona de Perigo - Deletar Conta */}
      <div className="bg-red-900/30 rounded-xl shadow-card-shadow p-6 border border-red-700 mt-12">
        <h2 className="text-xl font-bold text-red-300 mb-4">
          ⚠️ Zona de Perigo
        </h2>

        {!showDeleteConfirm ? (
          <>
            <p className="text-sm text-red-200 mb-4">
              Excluir sua conta é uma ação permanente. Isso deletará seu perfil de autenticação, mas **não** excluirá seus dados do Firestore (ciclos, registros) automaticamente.
            </p>
            <button
              onClick={() => {
                setShowDeleteConfirm(true);
                setMessage({ type: '', text: '' });
                setSenhaMessage({ type: '', text: '' });
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
            >
              Excluir Minha Conta
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="font-semibold text-red-300">
              Confirme sua senha para excluir sua conta permanentemente:
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full max-w-sm p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-text-color"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {deleteLoading && <Loader2 size={18} className="animate-spin mr-2" />}
                {deleteLoading ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setMessage({ type: '', text: '' });
                }}
                className="px-4 py-2 bg-gray-600 dark:bg-dark-border-color text-white dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-700 flex items-center"
              >
                <X size={18} /> <span className="ml-1">Cancelar</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default ProfilePage;
