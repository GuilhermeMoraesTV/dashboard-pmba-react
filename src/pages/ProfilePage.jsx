import React, { useState, useMemo } from 'react';
import { auth, db } from '../firebaseConfig';
import { updateEmail, updatePassword, sendEmailVerification, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

// Ícones
const IconUser = () => <span className="text-4xl">👤</span>;
const IconEdit = () => <span>✏️</span>;
const IconSave = () => <span>💾</span>;
const IconCancel = () => <span>❌</span>;
const IconStats = () => <span>📊</span>;
const IconArchive = () => <span>📦</span>;

function ProfilePage({ user }) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Estados para estatísticas
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [ciclosArquivados, setCiclosArquivados] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Carrega estatísticas
  React.useEffect(() => {
    if (!user) return;

    const loadStats = async () => {
      setLoadingStats(true);

      try {
        // Total de registros
        const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
        const registrosSnap = await getDocs(registrosRef);
        setTotalRegistros(registrosSnap.size);

        // Ciclos arquivados
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

  // Reautenticação (necessária para operações sensíveis)
  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  // Atualizar Email
  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user.email) {
      setMessage({ type: 'error', text: 'Digite um novo e-mail válido.' });
      return;
    }

    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Digite sua senha atual para confirmar.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await reauthenticate(currentPassword);
      await updateEmail(auth.currentUser, newEmail);
      await sendEmailVerification(auth.currentUser);

      setMessage({
        type: 'success',
        text: 'E-mail atualizado! Verifique sua caixa de entrada para confirmar o novo e-mail.'
      });
      setIsEditingEmail(false);
      setCurrentPassword('');
    } catch (error) {
      console.error("Erro ao atualizar e-mail:", error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Senha atual incorreta.' });
      } else if (error.code === 'auth/email-already-in-use') {
        setMessage({ type: 'error', text: 'Este e-mail já está em uso.' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao atualizar e-mail. Tente novamente.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Atualizar Senha
  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Preencha todos os campos de senha.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await reauthenticate(currentPassword);
      await updatePassword(auth.currentUser, newPassword);

      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setIsEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Senha atual incorreta.' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao atualizar senha. Tente novamente.' });
      }
    } finally {
      setLoading(false);
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
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
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

      {/* Mensagens */}
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

            {/* Email */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-2">
                E-mail
              </label>
              {!isEditingEmail ? (
                <div className="flex items-center justify-between p-3 bg-background-color dark:bg-dark-background-color rounded-lg">
                  <span className="text-text-color dark:text-dark-text-color">{user.email}</span>
                  <button
                    onClick={() => setIsEditingEmail(true)}
                    className="text-primary-color hover:brightness-110 font-semibold"
                  >
                    <IconEdit /> Editar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Novo e-mail"
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Senha atual (para confirmar)"
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateEmail}
                      disabled={loading}
                      className="px-4 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110 disabled:opacity-50"
                    >
                      <IconSave /> Salvar
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingEmail(false);
                        setNewEmail(user.email);
                        setCurrentPassword('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                    >
                      <IconCancel /> Cancelar
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
              {!isEditingPassword ? (
                <div className="flex items-center justify-between p-3 bg-background-color dark:bg-dark-background-color rounded-lg">
                  <span className="text-text-color dark:text-dark-text-color">••••••••</span>
                  <button
                    onClick={() => setIsEditingPassword(true)}
                    className="text-primary-color hover:brightness-110 font-semibold"
                  >
                    <IconEdit /> Alterar Senha
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Senha atual"
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha (mín. 6 caracteres)"
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdatePassword}
                      disabled={loading}
                      className="px-4 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110 disabled:opacity-50"
                    >
                      <IconSave /> Salvar
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                    >
                      <IconCancel /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ciclos Arquivados */}
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
              <div className="space-y-3">
                {ciclosArquivados.map(ciclo => (
                  <div key={ciclo.id} className="p-4 bg-background-color dark:bg-dark-background-color rounded-lg">
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

        {/* Coluna Direita - Estatísticas */}
        <div className="lg:col-span-1 space-y-6">

          {/* Card de Estatísticas */}
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

          {/* Informações da Conta */}
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
    </div>
  );
}

export default ProfilePage;