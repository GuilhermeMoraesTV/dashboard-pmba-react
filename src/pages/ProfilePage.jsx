import React, { useState, useMemo, useEffect } from 'react';
import { auth, db, storage } from '../firebaseConfig.js'; // 1. Importar storage
import {
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  deleteUser,
  updateProfile // 2. Importar updateProfile
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, updateDoc, deleteDoc, writeBatch, getDocs as getFirestoreDocs // 3. Importar funções do Firestore
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // 4. Importar funções do Storage

// --- Ícones (Usando Lucide-React para consistência) ---
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
  ArchiveRestore
} from 'lucide-react';

// 5. Placeholder para avatar
const IconUserAvatar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary-color">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);
// --- Fim dos Ícones ---


function ProfilePage({ user }) {
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

  // --- 6. Estado para upload de foto ---
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

  // 7. Atualizar o preview se a prop 'user' mudar
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

        // Usar onSnapshot para atualizações em tempo real
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

  // Reautenticação (Mantida para Deletar Conta)
  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  // --- 8. Lógica de Upload/Atualização da Foto de Perfil ---
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
      // 1. Fazer upload da nova foto
      const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
      const snapshot = await uploadBytes(storageRef, photo);
      const photoURL = await getDownloadURL(snapshot.ref);

      // 2. Atualizar o perfil do Auth
      await updateProfile(auth.currentUser, { photoURL: photoURL });

      // 3. Atualizar o documento do Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { photoURL: photoURL });

      setMessage({ type: 'success', text: 'Foto de perfil atualizada!' });
      setPhoto(null); // Limpar o arquivo selecionado

    } catch (error) {
      console.error("Erro ao atualizar foto:", error);
      setPhotoError('Falha ao atualizar a foto. Tente novamente.');
    } finally {
      setPhotoLoading(false);
    }
  };
  // --- Fim Lógica de Foto ---

  // Atualizar Email (sem alteração)
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
        text: `Sucesso! Um link de verificação foi enviado para ${newEmail}. Clique nele para confirmar a alteração.`
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

  // Redefinir Senha (sem alteração)
  const handleSendPasswordReset = async () => {
    // ... (mesma lógica do seu arquivo)
    if (!auth.currentUser) return;
    setSenhaLoading(true);
    setMessage({ type: '', text: '' });
    setSenhaMessage({ type: '', text: '' });
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSenhaMessage({
        type: 'success',
        text: `Link de redefinição enviado para ${user.email}. Verifique sua caixa de entrada.`
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      setSenhaMessage({ type: 'error', text: 'Erro ao enviar e-mail. Tente novamente.' });
    }
    setSenhaLoading(false);
  };

  // Deletar a conta (sem alteração)
  const handleDeleteAccount = async () => {
    // ... (mesma lógica do seu arquivo)
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Digite sua senha para confirmar a exclusão.' });
      return;
    }
    setDeleteLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await reauthenticate(deletePassword);
      // **AVISO**: Isso deleta o *usuário do Auth*, mas NÃO deleta
      // a subcoleção 'users/{userId}/...' no Firestore.
      // Para isso, você precisaria de uma Cloud Function.
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

  // --- 9. Funções para Ciclos Arquivados ---
  const handleUnarchiveCycle = async (cicloId) => {
    if (!user) return;
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    try {
      await updateDoc(cicloRef, { arquivado: false });
      setMessage({ type: 'success', text: 'Ciclo desarquivado com sucesso!' });
    } catch (error) {
      console.error("Erro ao desarquivar ciclo:", error);
      setMessage({ type: 'error', text: 'Não foi possível desarquivar o ciclo.' });
    }
  };

  const handleDeleteCycle = async (cicloId) => {
    if (!user) return;
    if (!window.confirm("ATENÇÃO: Excluir um ciclo é permanente. Isso NÃO excluirá os registros de estudo associados. Deseja continuar?")) {
      return;
    }

    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    try {
      // **AVISO IMPORTANTE**:
      // Isso deleta APENAS o documento do ciclo.
      // Os documentos nas subcoleções (disciplinas, topicos) NÃO são deletados.
      // A exclusão de subcoleções no cliente é complexa e lenta.
      // A forma CORRETA de fazer isso é com uma Cloud Function
      // que ouve a exclusão do ciclo e deleta suas subcoleções.

      // Para agora, vamos deletar o ciclo principal:
      await deleteDoc(cicloRef);
      setMessage({ type: 'success', text: 'Ciclo excluído com sucesso.' });
    } catch (error) {
      console.error("Erro ao excluir ciclo:", error);
      setMessage({ type: 'error', text: 'Não foi possível excluir o ciclo.' });
    }
  };
  // --- Fim Funções de Ciclo ---


  // Estatísticas calculadas (sem alteração)
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
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">

      {/* 10. Cabeçalho ATUALIZADO com Foto e Nome */}
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
            {/* Botão de Upload de Foto */}
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
            {/* 11. Botão de salvar foto (só aparece se uma foto for selecionada) */}
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

      {/* Mensagens (sem alteração) */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna Esquerda - Informações */}
        <div className="lg:col-span-2 space-y-6">

          {/* Informações Pessoais (E-mail e Senha) */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
              Segurança da Conta
            </h2>

            {/* Email (JSX ATUALIZADO) */}
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
                    className="w-full p-3 rounded-lg bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
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
                      className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color text-gray-800 dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-300 flex items-center"
                    >
                      <X size={18} /> <span className="ml-1">Cancelar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Senha (sem alteração) */}
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
                  className="px-4 py-2 bg-card-background-color text-text-color border border-border-color rounded-lg font-semibold hover:bg-border-color disabled:opacity-50 flex items-center justify-center"
                >
                  {senhaLoading && <Loader2 size={18} className="animate-spin mr-2" />}
                  {senhaLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </button>
              </div>
            </div>
          </div>

          {/* 12. Ciclos Arquivados ATUALIZADO */}
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

          {/* 13. SEÇÃO "INFORMAÇÕES DA CONTA" REMOVIDA */}

        </div>

      </div>

      {/* Zona de Perigo - Deletar Conta (sem alteração) */}
      <div className="lg:col-span-3 bg-red-900/30 rounded-xl shadow-card-shadow p-6 border border-red-700">
        <h2 className="text-xl font-bold text-red-300 mb-4">
          Zona de Perigo
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
              className="w-full max-w-sm p-3 rounded-lg bg-background-color border border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
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
                className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color text-gray-800 dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-300 flex items-center"
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