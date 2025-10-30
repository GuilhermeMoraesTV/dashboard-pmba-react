import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom'; // 1. Importe Link e useNavigate
import { auth, db, storage } from '../firebaseConfig'; // 2. Importe os serviços reais
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- Ícones (copiados do seu arquivo) ---
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
// Ícone para Upload de Foto
const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
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
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
// --- Fim Ícones ---


function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 3. Novos estados para foto
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const navigate = useNavigate(); // 4. Hook para redirecionar

  // Validação de senha (sem alteração)
  const passwordRequirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordRequirements).every(req => req);

  // 5. Função para lidar com a seleção da foto
  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // 6. Lógica de Cadastro REAL
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // --- Validações (sem alteração) ---
    if (!name.trim()) {
      setError('Por favor, preencha seu nome completo.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    if (!isPasswordValid) {
      setError('A senha não atende aos requisitos de segurança.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!acceptTerms) {
      setError('Você precisa aceitar os Termos & Condições.');
      return;
    }
    // --- Fim Validações ---

    setLoading(true);

    try {
      // 1. Criar o usuário no Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let photoURL = null;

      // 2. Fazer upload da foto (se existir)
      if (photo) {
        const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
        const snapshot = await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      // 3. Atualizar o perfil do Auth (salva nome e foto no Auth)
      await updateProfile(user, {
        displayName: name,
        photoURL: photoURL
      });

      // 4. Criar o documento do usuário no Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        name: name,
        email: email,
        photoURL: photoURL,
        createdAt: serverTimestamp()
      });

      setLoading(false);
      navigate('/'); // Redireciona para o dashboard

    } catch (err) {
      setLoading(false);
      console.error("Erro no cadastro:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está sendo utilizado.');
      } else {
        setError('Falha ao criar a conta. Tente novamente.');
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* LADO ESQUERDO: IMAGEM (sem alteração) */}
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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="text-6xl font-black text-white mb-4 tracking-wider" style={{ textShadow: '0 0 30px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.6)' }}>
              PMBA
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-4"></div>
            <p className="text-xl text-gray-200 font-light tracking-widest" style={{ textShadow: '0 0 20px rgba(0,0,0,0.9)' }}>
              SISTEMA DE TREINAMENTO
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* LADO DIREITO: FORMULÁRIO */}
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative z-10 overflow-y-auto"
      >
        <div className="w-full max-w-md my-8">

          {/* Logo (sem alteração) */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <img src="/logo-pmba.png" alt="Logo PMBA" className="h-16 w-auto" />
          </motion.div>

          {/* Título (sem alteração) */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-2 tracking-wide">
              CRIAR CONTA
            </h2>
            <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto mb-3"></div>
            <p className="text-sm text-gray-400 tracking-wide">
              Preencha os dados para começar
            </p>
          </motion.div>

          {/* Formulário */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            onSubmit={handleSignup}
            className="space-y-5"
          >
            {/* Mensagem de Erro (sem alteração) */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center font-medium backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}

            {/* 7. Input de Foto de Perfil */}
            <div>
              <label className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Foto de Perfil (Opcional)
              </label>
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-gray-800 flex items-center justify-center text-gray-500 overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <IconCamera />
                  )}
                </motion.div>
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer p-3 rounded-lg bg-[#1a1a1a] text-gray-300 border border-gray-800 hover:border-red-600 hover:text-white transition-all text-sm font-medium"
                >
                  Selecionar Foto
                  <input
                    id="photo-upload"
                    name="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Input de Nome (sem alteração) */}
            <div>
              <label htmlFor="name" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Nome Completo
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <IconUser />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="Digite seu nome completo"
                />
              </div>
            </div>

            {/* Input de E-mail (sem alteração) */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
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
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            {/* Inputs de Senha e Requisitos (sem alteração) */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <IconPassword />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
              </div>
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${passwordRequirements.length ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.length && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.length ? 'text-green-400' : 'text-gray-500'}>
                      Mínimo de 6 caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${passwordRequirements.uppercase ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.uppercase && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.uppercase ? 'text-green-400' : 'text-gray-500'}>
                      Uma letra maiúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${passwordRequirements.lowercase ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.lowercase && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.lowercase ? 'text-green-400' : 'text-gray-500'}>
                      Uma letra minúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${passwordRequirements.number ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {passwordRequirements.number && <IconCheck />}
                    </div>
                    <span className={passwordRequirements.number ? 'text-green-400' : 'text-gray-500'}>
                      Um número
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Confirmar Senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
                  <IconPassword />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3.5 pl-12 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                  placeholder="••••••••"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-2 text-xs text-red-400">As senhas não coincidem</p>
              )}
            </div>

            {/* Aceitar Termos (sem alteração) */}
            <div>
              <label className="flex items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-[#1a1a1a] border-gray-800 text-red-600 focus:ring-red-600 focus:ring-offset-0 cursor-pointer"
                />
                <span className="ml-2 text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                  Eu aceito os{' '}
                  <a href="#" className="text-red-500 hover:text-red-400 underline">
                    Termos & Condições
                  </a>
                  {' '}e a{' '}
                  <a href="#" className="text-red-500 hover:text-red-400 underline">
                    Política de Privacidade
                  </a>
                </span>
              </label>
            </div>

            {/* Botão de Cadastrar (sem alteração) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden p-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold tracking-wider uppercase text-sm shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (
                    <>
                      <IconLoader />
                      <span className="ml-2">Cadastrando...</span>
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </button>
            </div>
          </motion.form>

          {/* Link de Login (Modificado para usar <Link>) */}
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
              Já tem uma conta?{' '}
              <Link
                to="/login"
                className="font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wide"
              >
                Entrar
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default Signup;