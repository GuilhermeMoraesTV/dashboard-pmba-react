import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { auth } from '../firebaseConfig'; // Verifique o caminho
import { sendPasswordResetEmail } from 'firebase/auth';

// --- ÍCONES ---
const IconEmail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
  </svg>
);

const IconLoader = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const IconArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage({
        type: 'success',
        content: 'Link enviado! Verifique sua caixa de entrada (e spam).'
      });
      setEmail(''); // Limpa o campo após sucesso
    } catch (err) {
      console.error(err);
      let errorMsg = 'Erro ao enviar o e-mail. Tente novamente.';
      if (err.code === 'auth/user-not-found') errorMsg = 'E-mail não encontrado no sistema.';
      if (err.code === 'auth/invalid-email') errorMsg = 'Formato de e-mail inválido.';

      setMessage({ type: 'error', content: errorMsg });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] relative overflow-hidden font-sans items-center justify-center py-4">

      {/* HACK CSS (Mesmo do Login) */}
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
          alt="Background"
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

          {/* Cabeçalho */}
          <div className="flex justify-center mb-4">
            <img src="/logo-pmba.png" alt="Logo PMBA" className="h-16 w-auto drop-shadow-2xl" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">
              Recuperar Acesso
            </h2>
            <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-3"></div>
            <p className="text-xs text-gray-400 tracking-wide leading-relaxed px-2">
              Digite seu e-mail cadastrado para receber o link de redefinição de senha.
            </p>
          </div>

          {/* Feedback de Erro/Sucesso */}
          {message.content && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`mb-4 p-3 border rounded-lg text-xs text-center font-medium backdrop-blur-md ${
                message.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {message.content}
            </motion.div>
          )}

          <form onSubmit={handleReset} className="space-y-4">

            {/* Input Email */}
            <div>
              <label htmlFor="email" className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">
                E-mail Cadastrado
              </label>
              <div className="flex items-center w-full rounded-lg bg-[#1a1a1a] border border-gray-700 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                   <IconEmail />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-2.5 pr-3 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            {/* Botão de Enviar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden p-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold tracking-wider uppercase text-xs shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (
                    <>
                      <IconLoader />
                      <span className="ml-2">Enviando...</span>
                    </>
                  ) : (
                    'Enviar Link de Recuperação'
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </form>

          {/* Rodapé - Voltar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 pt-3 border-t border-gray-700 text-center"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wide group"
            >
              <span className="group-hover:-translate-x-1 transition-transform duration-200">
                <IconArrowLeft />
              </span>
              Voltar para o Login
            </Link>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}

export default ForgotPassword;