import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom'; // Importado para o link "Cadastre-se"
import { auth } from '/src/firebaseConfig.js'; // CAMINHO ABSOLUTO CORRIGIDO
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Funções reais

// --- Ícones (Sem alteração) ---
const IconEmail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
  </svg>
);
const IconPassword = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);
const IconLoader = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
// --- Fim Ícones ---


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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 lg:px-12">
      <div className="w-full max-w-6xl grid items-stretch gap-10 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, x: -80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative hidden lg:flex lg:col-span-2"
        >
          <div className="custom-card relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1b1b1f] via-[#111114] to-[#050506] text-white shadow-2xl">
            <div className="absolute -top-16 -left-20 h-36 w-36 rotate-12 rounded-2xl border border-primary-dark bg-primary-dark"></div>
            <div className="absolute top-24 -left-10 h-16 w-16 rotate-45 border border-primary-light"></div>
            <div className="absolute -bottom-24 right-6 h-40 w-40 rotate-12 rounded-3xl border border-[#351313] bg-[#250d0d]"></div>
            <div className="relative z-10">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-light">Treinamento PMBA</span>
              <h1 className="mt-6 text-3xl font-extrabold leading-tight">
                Disciplina, estratégia e resultado em um só painel
              </h1>
              <p className="mt-4 text-sm text-zinc-300">
                Visual militar moderno com superfícies sólidas e contrastes precisos para acompanhar seus ciclos de estudo.
              </p>
            </div>
            <ul className="relative z-10 mt-8 space-y-4 text-sm text-zinc-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-6 rounded-sm bg-primary-light"></span>
                <div>
                  <p className="font-semibold text-white">Ciclos táticos personalizados</p>
                  <p className="text-zinc-400">Estruture disciplinas, metas e revisões com clareza total.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-6 rounded-sm bg-primary-light"></span>
                <div>
                  <p className="font-semibold text-white">Indicadores em tempo real</p>
                  <p className="text-zinc-400">Monitore desempenho, constância e evolução diária.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-6 rounded-sm bg-primary-light"></span>
                <div>
                  <p className="font-semibold text-white">Experiência totalmente responsiva</p>
                  <p className="text-zinc-400">Interface profissional para desktop, tablet ou celular.</p>
                </div>
              </li>
            </ul>
            <div className="relative z-10 mt-10 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-zinc-500">
              <img src="/logo-pmba.png" alt="Logo PMBA" className="h-10 w-10 rounded-lg border border-[#2d2d30] bg-[#1a1a1d] object-contain p-2" />
              <span>Pronto para a próxima missão</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex lg:col-span-3"
        >
          <div className="custom-card relative w-full p-8 sm:p-10 lg:p-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-light">Acesso seguro</span>
                <h2 className="mt-3 text-3xl font-extrabold text-text-heading dark:text-text-dark-heading">
                  Bem-vindo de volta
                </h2>
                <p className="mt-2 text-sm text-text-subtle dark:text-text-dark-subtle">
                  Entre para acompanhar o seu desempenho, metas e registros de estudo.
                </p>
              </div>
              <div className="hidden sm:block">
                <img src="/logo-pmba.png" alt="Escudo PMBA" className="h-16 w-16 rounded-xl border border-border-light dark:border-border-dark bg-card-light p-3 dark:bg-[#131316]" />
              </div>
            </div>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-lg border border-red-600 bg-red-200 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                >
                  {error}
                </motion.div>
              )}

              {forgotPasswordSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-lg border border-green-600 bg-green-200 px-4 py-3 text-sm font-semibold text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200"
                >
                  {forgotPasswordSuccess}
                </motion.div>
              )}

              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:text-text-dark-subtle">
                  E-mail
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-subtle transition-colors group-focus-within:text-primary-light dark:text-text-dark-subtle">
                    <IconEmail />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-light bg-card-light p-3.5 pl-12 text-text-DEFAULT placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-[#131316] dark:text-white dark:placeholder:text-text-dark-subtle"
                    placeholder="seu.email@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:text-text-dark-subtle">
                  Senha
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-subtle transition-colors group-focus-within:text-primary-light dark:text-text-dark-subtle">
                    <IconPassword />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-border-light bg-card-light p-3.5 pl-12 text-text-DEFAULT placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-[#131316] dark:text-white dark:placeholder:text-text-dark-subtle"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 text-sm text-text-subtle dark:text-text-dark-subtle">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border-light bg-card-light text-primary focus:ring-primary focus:ring-offset-0 dark:border-border-dark dark:bg-[#131316]"
                  />
                  <span className="font-medium">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  disabled={forgotPasswordLoading}
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-primary hover:text-primary-light transition-colors disabled:opacity-60"
                >
                  {forgotPasswordLoading ? 'Enviando...' : 'Esqueceu a senha?'}
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || forgotPasswordLoading}
                  className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-primary px-5 py-3 text-sm font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                      <>
                        <IconLoader />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </span>
                  <span className="absolute inset-0 z-0 origin-left scale-x-0 bg-primary-dark transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                </button>
              </div>
            </motion.form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="mt-10"
            >
              <div className="relative flex items-center justify-center">
                <span className="h-px w-full bg-border-light dark:bg-border-dark"></span>
                <span className="mx-4 rounded-full bg-card-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:bg-[#131316] dark:text-text-dark-subtle">
                  Ou
                </span>
                <span className="h-px w-full bg-border-light dark:bg-border-dark"></span>
              </div>
              <p className="mt-6 text-center text-sm text-text-subtle dark:text-text-dark-subtle">
                Não tem uma conta?
                <Link to="/signup" className="ml-2 font-semibold uppercase tracking-[0.2em] text-primary hover:text-primary-light">
                  Cadastre-se
                </Link>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;

