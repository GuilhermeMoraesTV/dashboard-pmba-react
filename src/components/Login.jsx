import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom'; // Importado para o link "Cadastre-se"
import { Mail, Lock, Loader2 } from 'lucide-react';
import { auth } from '/src/firebaseConfig.js'; // CAMINHO ABSOLUTO CORRIGIDO
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Funções reais

// --- FUNÇÃO DE TRADUÇÃO DE ERROS (RE-ADICIONADA) ---
const translateFirebaseError = (errorCode) => {
  switch (errorCode) {
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'E-mail ou senha inválidos.';
    case 'auth/invalid-email':
      return 'O formato do e-mail é inválido.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.';
    default:
      return 'Falha ao fazer login. Verifique seus dados.';
  }
};
// --- FIM FUNÇÃO ---


function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // --- LÓGICA DE LOGIN (CORRIGIDA) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotPasswordSuccess('');
    setLoading(true);

    try {
      // Lógica real do Firebase
      await signInWithEmailAndPassword(auth, email, password);
      // O redirecionamento é tratado pelo App.jsx (que ouve o onAuthStateChanged)
    } catch (err) {
      console.error("Erro de login:", err.code);
      setError(translateFirebaseError(err.code));
    }
    setLoading(false);
  };
  // --- FIM LÓGICA DE LOGIN ---

  // --- ESQUECEU A SENHA (CORRIGIDO) ---
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail no campo acima para redefinir a senha.');
      return;
    }
    setError('');
    setForgotPasswordSuccess('');
    setForgotPasswordLoading(true);

    try {
      // Lógica real do Firebase
      await sendPasswordResetEmail(auth, email);
      setForgotPasswordSuccess(`Link de redefinição enviado para ${email}. Verifique sua caixa de entrada.`);
    } catch (err) {
      console.error("Erro ao redefinir senha:", err.code);
      setError(err.code === 'auth/invalid-email' ? 'O e-mail digitado é inválido.' : 'Erro ao enviar o e-mail.');
    }
    setForgotPasswordLoading(false);
  };
  // --- FIM ESQUECEU A SENHA ---

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="hidden overflow-hidden rounded-3xl border border-border-light bg-card-light shadow-card-shadow dark:border-border-dark dark:bg-card-dark lg:flex lg:flex-col"
        >
          <img
            src="/imagem-login.png"
            alt="Treinamento PMBA"
            className="h-full w-full object-cover"
          />
          <div className="border-t border-border-light bg-card-light p-8 dark:border-border-dark dark:bg-card-dark">
            <h2 className="text-2xl font-semibold text-text-heading dark:text-text-dark-heading">
              Preparado para o próximo passo?
            </h2>
            <p className="mt-3 text-sm text-text-subtle dark:text-text-dark-subtle">
              Acompanhe seus ciclos de estudo, metas e desempenho com uma experiência visual moderna e consistente.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full rounded-3xl border border-border-light bg-card-light p-8 shadow-card-shadow dark:border-border-dark dark:bg-card-dark"
        >
          <div className="flex justify-center">
            <img src="/logo-pmba.png" alt="Logo PMBA" className="h-16 w-auto" />
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-3xl font-bold text-text-heading dark:text-text-dark-heading">Acesse sua conta</h1>
            <p className="mt-2 text-sm text-text-subtle dark:text-text-dark-subtle">
              Use seu e-mail institucional para entrar na plataforma.
            </p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            onSubmit={handleSubmit}
            className="mt-10 space-y-6"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 dark:border-red-800 dark:bg-red-900 dark:text-red-200"
              >
                {error}
              </motion.div>
            )}

            {forgotPasswordSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-900 dark:text-green-200"
              >
                {forgotPasswordSuccess}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-text-subtle dark:text-text-dark-subtle">
                E-mail
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border-light bg-background-light px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:border-border-dark dark:bg-[#2b3033]">
                <Mail className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-base text-text-DEFAULT placeholder:text-neutral-500 focus:outline-none dark:text-text-dark-DEFAULT"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-text-subtle dark:text-text-dark-subtle">
                Senha
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border-light bg-background-light px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:border-border-dark dark:bg-[#2b3033]">
                <Lock className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-base text-text-DEFAULT placeholder:text-neutral-500 focus:outline-none dark:text-text-dark-DEFAULT"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-text-subtle dark:text-text-dark-subtle">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border border-border-light text-primary focus:ring-primary focus:ring-offset-0 dark:border-border-dark"
                />
                Lembrar-me
              </label>
              <button
                type="button"
                disabled={forgotPasswordLoading}
                onClick={handleForgotPassword}
                className="text-sm font-semibold text-danger-color transition-colors hover:text-red-600 disabled:opacity-60"
              >
                {forgotPasswordLoading ? 'Enviando...' : 'Esqueceu a senha?'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || forgotPasswordLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-danger-color px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </motion.form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
            className="mt-10 text-center"
          >
            <div className="relative flex items-center">
              <div className="h-px flex-1 bg-border-light dark:bg-border-dark"></div>
              <span className="mx-3 rounded-full bg-card-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-subtle dark:bg-card-dark dark:text-text-dark-subtle">
                Ou
              </span>
              <div className="h-px flex-1 bg-border-light dark:bg-border-dark"></div>
            </div>
            <p className="mt-4 text-sm text-text-subtle dark:text-text-dark-subtle">
              Não tem uma conta?
              <Link
                to="/signup"
                className="ml-1 font-semibold text-danger-color transition-colors hover:text-red-600"
              >
                Cadastre-se
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;
