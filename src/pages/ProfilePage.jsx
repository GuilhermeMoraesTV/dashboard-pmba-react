import React, { useState, useMemo, useEffect } from 'react';
import { auth, db } from '../firebaseConfig.js'; // Caminho corrigido
import {
  // updateEmail, // Não vamos mais usar
  // sendEmailVerification, // Não é mais necessário separadamente
  verifyBeforeUpdateEmail, // <-- O MÉTODO CORRETO
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

// --- Ícones (Sem alteração) ---
const IconUser = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary-color">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);
const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 inline-block">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);
const IconSave = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 inline-block">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const IconCancel = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1 inline-block">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);
const IconStats = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-heading-color dark:text-dark-heading-color">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
);
const IconArchive = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-heading-color dark:text-dark-heading-color">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);
const IconLoader = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
// --- Fim dos Ícones ---


function ProfilePage({ user }) {
  // --- Estados de E-mail (CORRIGIDO) ---
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  // const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState(''); // <-- NÃO É MAIS NECESSÁRIO

  // --- Estados de Senha ---
  const [senhaMessage, setSenhaMessage] = useState({ type: '', text: '' });
  const [senhaLoading, setSenhaLoading] = useState(false);

  // --- Estados de Exclusão ---
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Estados Gerais ---
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false); // Agora usado apenas pelo formulário de e-mail

  // --- Estados de Estatísticas ---
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [ciclosArquivados, setCiclosArquivados] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Carrega estatísticas (Sem alteração)
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

  // Reautenticação (Mantida para Deletar Conta)
  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  // ATUALIZADO: Atualizar Email (Fluxo de Verificação)
  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user.email) {
      setMessage({ type: 'error', text: 'Digite um novo e-mail válido.' });
      return;
    }

    // Não precisamos mais da senha aqui
    // if (!currentPasswordForEmail) { ... }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // NÃO precisa de reautenticação para ESTA função
      // Esta é a função correta que o Firebase estava pedindo
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);

      setMessage({
        type: 'success',
        text: `Sucesso! Um link de verificação foi enviado para ${newEmail}. Clique nele para confirmar a alteração.`
      });
      setIsEditingEmail(false);
      // setCurrentPasswordForEmail(''); // <-- Não é mais necessário
    } catch (error) {
      console.error("Erro ao atualizar e-mail:", error);
      // 'auth/wrong-password' não acontecerá mais aqui
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

  // Redefinir Senha (Sem alteração)
  const handleSendPasswordReset = async () => {
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

  // Deletar a conta (Sem alteração)
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

  // Estatísticas calculadas (Sem alteração)
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

      {/* Cabeçalho (Sem alteração) */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-primary-color/20 flex items-center justify-center">
              <IconUser />
            </div>
          </div>
          <div className="flex-grow">
            <h1 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color">
              Área do Estudante
            </h1>
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
              Gerencie suas informações pessoais e acompanhe seu progresso
            </p>
          </div>
        </div>
      </div>

      {/* Mensagens (Sem alteração) */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700'
            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna Esquerda - Informações */}
        <div className="lg:col-span-2 space-y-6">

          {/* Informações Pessoais */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
              Informações Pessoais
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
                    className="text-primary-color hover:brightness-110 font-semibold flex items-center"
                  >
                    <IconEdit /> Editar
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Novo e-mail"
                    className="w-full p-3 rounded-lg bg-white dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  {/* --- CAMPO DE SENHA REMOVIDO DAQUI --- */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateEmail}
                      disabled={loading}
                      className="px-4 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? <IconLoader /> : <IconSave />}
                      Enviar Verificação
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingEmail(false);
                        setNewEmail(user.email);
                        // setCurrentPasswordForEmail(''); // Não é mais necessário
                        setMessage({ type: '', text: '' });
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color text-gray-800 dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-300 flex items-center"
                    >
                      <IconCancel /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Senha (Sem alteração, continua usando o método de redefinição) */}
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
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {senhaMessage.text}
                  </div>
                )}
                <button
                  onClick={handleSendPasswordReset}
                  disabled={senhaLoading}
                  className="px-4 py-2 bg-secondary-color dark:bg-dark-secondary-color text-heading-color dark:text-dark-heading-color rounded-lg font-semibold hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
                >
                  {senhaLoading && <IconLoader />}
                  {senhaLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </button>
              </div>
            </div>
          </div>

          {/* Ciclos Arquivados (Sem alteração) */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 flex items-center gap-2">
              <IconArchive /> Ciclos Arquivados
            </h2>
            {loadingStats ? (
              <p className="text-subtle-text-color dark:text-dark-subtle-text-color">Carregando...</p>
            ) : ciclosArquivados.length === 0 ? (
              <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-center py-8">
                Nenhum ciclo arquivado ainda.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {ciclosArquivados.map(ciclo => (
                  <div key={ciclo.id} className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color">
                    <h3 className="font-semibold text-text-color dark:text-dark-text-color">
                      {ciclo.nome}
                    </h3>
                    <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                      Carga: {ciclo.cargaHorariaSemanalTotal}h/semana
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita - Estatísticas (Sem alteração) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 flex items-center gap-2">
              <IconStats /> Suas Estatísticas
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
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-3">
              Informações da Conta
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-subtle-text-color dark:text-dark-subtle-text-color">ID do Usuário:</span>
                <span className="text-text-color dark:text-dark-text-color font-mono text-xs">
                  {user.uid.substring(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle-text-color dark:text-dark-subtle-text-color">E-mail verificado:</span>
                <span className={user.emailVerified ? 'text-success-color' : 'text-warning-color'}>
                  {user.emailVerified ? 'Sim ✓' : 'Não ⚠'}
                </span>
              </div>
              {user.metadata?.creationTime && (
                <div className="flex justify-between">
                  <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Membro desde:</span>
                  <span className="text-text-color dark:text-dark-text-color">
                    {new Date(user.metadata.creationTime).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Zona de Perigo - Deletar Conta (Sem alteração) */}
      <div className="lg:col-span-3 bg-red-50 dark:bg-red-900/30 rounded-xl shadow-card-shadow p-6 border border-red-300 dark:border-red-700">
        <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-4">
          Zona de Perigo
        </h2>

        {!showDeleteConfirm ? (
          <>
            <p className="text-sm text-red-600 dark:text-red-200 mb-4">
              Excluir sua conta é uma ação permanente e não pode ser desfeita. Todos os seus dados de autenticação serão perdidos.
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
            <p className="font-semibold text-red-700 dark:text-red-300">
              Confirme sua senha para excluir sua conta permanentemente:
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full max-w-sm p-3 rounded-lg bg-white dark:bg-dark-background-color border border-red-300 dark:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {deleteLoading && <IconLoader />}
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
                <IconCancel /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default ProfilePage;

