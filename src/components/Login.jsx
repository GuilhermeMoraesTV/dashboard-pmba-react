import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { auth } from '/src/firebaseConfig.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

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

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotPasswordSuccess('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Erro de login:", err.code);
      setError(translateFirebaseError(err.code));
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail no campo acima para redefinir a senha.');
      return;
    }
    setError('');
    setForgotPasswordSuccess('');
    setForgotPasswordLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setForgotPasswordSuccess(`Link de redefinição enviado para ${email}. Verifique sua caixa de entrada.`);
    } catch (err) {
      console.error("Erro ao redefinir senha:", err.code);
      setError(err.code === 'auth/invalid-email' ? 'O e-mail digitado é inválido.' : 'Erro ao enviar o e-mail.');
    }
    setForgotPasswordLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)`
        }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a0a0a]/30 to-[#0a0a0a] z-10"></div>
        <img
          src="/imagem-login.png"
          alt="PMBA"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20" style={{
          backgroundImage: `linear-gradient(rgba(10,10,10,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.4) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative z-10"
      >
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <img src="/logo-pmba.png" alt="Logo PMBA" className="h-16 w-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-2 tracking-wide">
              Acesse sua conta
            </h2>
            <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-3"></div>
            <p className="text-sm text-gray-400 tracking-wide">
              Use seu e-mail e senha para continuar
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center font-medium backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}

            {forgotPasswordSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center font-medium backdrop-blur-sm"
              >
                {forgotPasswordSuccess}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="seu.email@exemplo.com"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <IconEmail />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <IconPassword />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#1a1a1a] border-gray-800 text-red-600 focus:ring-red-600 focus:ring-offset-0 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  Lembrar-me
                </span>
              </label>
              <button
                type="button"
                disabled={forgotPasswordLoading}
                onClick={handleForgotPassword}
                className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {forgotPasswordLoading ? 'Enviando...' : 'Esqueceu a senha?'}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || forgotPasswordLoading}
                className="w-full relative group overflow-hidden p-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold tracking-wider uppercase text-sm shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (
                    <>
                      <IconLoader />
                      <span className="ml-2">Entrando...</span>
                    </>
                  ) : (
                    'Entrar'
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </motion.form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-8 text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-2 bg-[#0a0a0a] text-gray-500 tracking-wider">
                  Ou
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              Não tem uma conta?{' '}
              <Link
                to="/signup"
                className="font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide"
              >
                Cadastre-se
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;