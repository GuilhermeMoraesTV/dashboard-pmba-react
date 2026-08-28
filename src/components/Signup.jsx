import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { buildInitialAccessProfile, LEGACY_ADMIN_UID } from '../auth/accessControl';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import AuthLayout from './auth/AuthLayout';
import { uploadSecureImage, validateImageFile } from '../services/secureImageUpload';

// --- Ícones ---
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
const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);
const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
  </svg>
);
const IconLoader = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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

function Signup({ onSetLightTheme }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  // Lógica de Requisitos de Senha
  const passwordRequirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordRequirements).every(req => req);

  const handlePhotoChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        await validateImageFile(file);
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        setError('');
      } catch (validationError) {
        e.target.value = '';
        setPhoto(null);
        setPhotoPreview(null);
        setError(validationError.message);
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Por favor, preencha seu nome completo.');
    if (!isPasswordValid) return setError('A senha não atende aos requisitos.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      localStorage.setItem('theme', 'light');
      localStorage.setItem(`modoqap_initial_theme_${user.uid}`, 'true');
      window.document.documentElement.classList.remove('dark');
      onSetLightTheme?.();
      let photoURL = null;

      if (photo) {
        ({ url: photoURL } = await uploadSecureImage(photo, { kind: 'profile-avatar' }));
      }

      await updateProfile(user, {
        displayName: name,
        photoURL: photoURL
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        photoURL: photoURL,
        createdAt: serverTimestamp(),
        studyStats: { totalTime: 0, completedCycles: 0, questionsSolved: 0 },
        access: buildInitialAccessProfile({ isLegacyAdmin: user.uid === LEGACY_ADMIN_UID }),
      });

      setLoading(false);
      navigate('/');

    } catch (err) {
      setLoading(false);
      console.error("Erro no cadastro:", err);
      if (err.code === 'auth/email-already-in-use') setError('Este e-mail já está cadastrado.');
      else if (err.code === 'auth/weak-password') setError('A senha é muito fraca.');
      else setError('Falha ao criar a conta. Tente novamente.');
    }
  };

  return (
    <AuthLayout mode="signup">
        <div className="rounded-2xl border border-white/10 bg-[#181a1d]/90 p-5 shadow-2xl shadow-black/45 backdrop-blur-xl sm:p-6">

          <div className="flex justify-center mb-4">
            <img src="/logoModoQAP.png" alt="Logo ModoQAP" className="h-20 w-auto drop-shadow-2xl" />
          </div>

          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">
              Criar Conta
            </h2>
            <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-2"></div>
            <p className="text-xs text-gray-400 tracking-wide">
              Junte-se à plataforma de elite
            </p>
          </div>

          {error && (
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-md"
            >
              <p className="text-red-400 text-xs text-center font-medium">{error}</p>
            </Motion.div>
          )}

          <form onSubmit={handleSignup} className="space-y-3">

            {/* Upload de Foto */}
            <div className="flex items-center gap-3 p-2 bg-[#222428]/90 border border-zinc-600/70 rounded-lg group hover:border-red-600/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#111315] border border-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <IconCamera />
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Foto de Perfil</label>
                <label
                  htmlFor="photo-upload"
                  className="inline-block text-xs text-red-500 font-bold hover:text-red-400 cursor-pointer uppercase tracking-wide"
                >
                  Selecionar Arquivo
                  <input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* Input Nome */}
            <div>
              <label className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">Nome Completo</label>
              <div className="flex items-center w-full rounded-lg bg-[#222428]/90 border border-zinc-600/70 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group relative">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                  <IconUser />
                </div>
                {/* ADICIONADO: border-none focus:ring-0 outline-none para remover bordas internas */}
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2.5 pr-3 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="Seu nome de guerra"
                />
              </div>
            </div>

            {/* Input Email */}
            <div>
              <label className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">E-mail</label>
              <div className="flex items-center w-full rounded-lg bg-[#222428]/90 border border-zinc-600/70 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group relative">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                  <IconEmail />
                </div>
                {/* ADICIONADO: border-none focus:ring-0 outline-none */}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-2.5 pr-3 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            {/* Input Senha */}
            <div>
              <label className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">Senha</label>
              <div className="flex items-center w-full rounded-lg bg-[#222428]/90 border border-zinc-600/70 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group relative">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                  <IconPassword />
                </div>
                {/* ADICIONADO: border-none focus:ring-0 outline-none */}
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 pr-10 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="••••••••"
                />
                {/* Botão de Olho */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3 text-gray-500 hover:text-white transition-colors focus:outline-none flex items-center"
                >
                  {showPassword ? <IconEyeSlash /> : <IconEye />}
                </button>
              </div>

              {/* REQUISITOS DE SENHA */}
              {password && (
                <Motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-1 bg-[#222428]/60 p-2 rounded-lg border border-gray-700/70"
                >
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${passwordRequirements.length ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.length && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.length ? 'text-green-400 font-bold' : 'text-gray-500'}>
                      Mínimo de 6 caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${passwordRequirements.uppercase ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.uppercase && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.uppercase ? 'text-green-400 font-bold' : 'text-gray-500'}>
                      Uma letra maiúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${passwordRequirements.lowercase ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.lowercase && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.lowercase ? 'text-green-400 font-bold' : 'text-gray-500'}>
                      Uma letra minúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${passwordRequirements.number ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.number && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.number ? 'text-green-400 font-bold' : 'text-gray-500'}>
                      Um número
                    </span>
                  </div>
                </Motion.div>
              )}
            </div>

            {/* Input Confirmar Senha */}
            <div>
              <label className="block text-[10px] font-bold mb-1 text-gray-300 uppercase tracking-wider">Confirmar Senha</label>
              <div className="flex items-center w-full rounded-lg bg-[#222428]/90 border border-zinc-600/70 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600 transition-all overflow-hidden group relative">
                <div className="pl-3 pr-2 py-2.5 text-gray-500 group-focus-within:text-red-500 transition-colors flex items-center justify-center">
                  <IconPassword />
                </div>
                {/* ADICIONADO: border-none focus:ring-0 outline-none */}
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full py-2.5 pr-10 bg-transparent text-white border-none focus:ring-0 outline-none placeholder:text-gray-600 text-sm"
                  placeholder="••••••••"
                />
                {/* Botão de Olho Confirmar */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3 text-gray-500 hover:text-white transition-colors focus:outline-none flex items-center"
                >
                  {showConfirmPassword ? <IconEyeSlash /> : <IconEye />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-[10px] text-red-400 font-bold pl-1">As senhas não coincidem</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden p-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold tracking-wider uppercase text-xs shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (<><IconLoader /><span className="ml-2">Cadastrando...</span></>) : ('Confirmar Cadastro')}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </form>

          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 pt-3 border-t border-gray-700 text-center"
          >
            <p className="text-xs text-gray-400">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide">
                Entrar
              </Link>
            </p>
          </Motion.div>

        </div>
    </AuthLayout>
  );
}

export default Signup;
