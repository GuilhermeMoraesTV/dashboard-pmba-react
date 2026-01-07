import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { auth } from '../firebaseConfig'; // Verifique o caminho
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

// --- ÍCONES (Padronizados) ---
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
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);
const IconEyeSlash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);
const IconLoader = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- UTILITÁRIOS ---
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

const checkboxVariants = {
  checked: { backgroundColor: "#dc2626", borderColor: "#dc2626", scale: 1 },
  unchecked: { backgroundColor: "rgba(26, 26, 26, 1)", borderColor: "#3f3f46", scale: 1 },
  hover: { borderColor: "#ef4444", scale: 1.05 }
};

const checkIconVariants = {
  checked: { pathLength: 1, opacity: 1 },
  unchecked: { pathLength: 0, opacity: 0 }
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Erro de login:", err.code);
      setError(translateFirebaseError(err.code));
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] relative overflow-hidden font-sans items-center justify-center py-4">

      {/* HACK CSS CORRIGIDO E PADRONIZADO */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #1a1a1a inset !important;
            -webkit-text-fill-color: white !important;
            caret-color: white !important;
            border-radius: 0px !important;
            border: none !important;
        }
      `}</style>

      {/* 1. IMAGEM DE FUNDO */}
      <div className="absolute inset-0 z-0">
        <img
          src="/imagem-login.png"
          alt="Background Login"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"></div>
      </div>

      {/* 2. CARD CENTRALIZADO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[360px] relative z-10 max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">

          {/* Logo Compacta */}
          <div className="flex justify-center mb-4">
            <img src="/logo-pmba.png" alt="Logo PMBA" className="h-24 w-auto drop-shadow-2xl" />
          </div>

          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">
              Acesse sua conta
            </h2>
            <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-2"></div>

            <p className="text-xs text-gray-400 tracking-wide">
              Não tem uma conta?{' '}
              <Link
                to="/signup"
                className="font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide"
              >
                Cadastre-se
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-center font-medium"
              >
                {error}
              </motion.div>
            )}

            {/* CAMPO DE EMAIL */}
            <div>
              <label htmlFor="email" className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">
                E-mail
              </label>
              <div className="flex items-center w-full rounded-lg bg-[#1a1a1a] border border-gray-700 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
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
                  className="w-full py-2.5 pr-3 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            {/* CAMPO DE SENHA */}
            <div>
              <label htmlFor="password" className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">
                Senha
              </label>

              <div className="flex items-center w-full rounded-lg bg-[#1a1a1a] border border-gray-700 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group relative">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                  <IconPassword />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 pr-10 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3 text-gray-500 hover:text-white transition-colors focus:outline-none flex items-center justify-center cursor-pointer z-10"
                >
                  {showPassword ? <IconEyeSlash /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Opções (Lembrar-me / Esqueceu Senha) */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <motion.div
                  className="w-4 h-4 rounded border mr-2 flex items-center justify-center shrink-0"
                  variants={checkboxVariants}
                  initial="unchecked"
                  animate={rememberMe ? "checked" : "unchecked"}
                  whileHover="hover"
                  transition={{ duration: 0.2 }}
                >
                   <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <motion.path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={checkIconVariants}
                        initial="unchecked"
                        animate={rememberMe ? "checked" : "unchecked"}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      />
                   </svg>
                </motion.div>
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                  Lembrar-me
                </span>
              </label>

              {/* LINK PARA A PÁGINA ESQUECI MINHA SENHA */}
              <Link
                to="/forgot-password"
                className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>

            {/* Botão de Ação */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden p-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold tracking-wider uppercase text-xs shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
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
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;