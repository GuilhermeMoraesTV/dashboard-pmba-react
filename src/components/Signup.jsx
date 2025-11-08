import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom'; // 1. Importe Link e useNavigate
import { Mail, Lock, User, Camera, Loader2, Check } from 'lucide-react';
import { auth, db, storage } from '../firebaseConfig'; // 2. Importe os serviços reais
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  const renderRequirementClass = (condition) =>
    condition
      ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900 dark:text-green-200'
      : 'border-border-light bg-background-light text-text-subtle dark:border-border-dark dark:bg-[#2b3033] dark:text-text-dark-subtle';

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
              Crie seu perfil de estudos
            </h2>
            <p className="mt-3 text-sm text-text-subtle dark:text-text-dark-subtle">
              Configure suas metas, acompanhe o desempenho e tenha uma visão completa da sua jornada na PMBA.
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
            <h1 className="text-3xl font-bold text-text-heading dark:text-text-dark-heading">Criar conta</h1>
            <p className="mt-2 text-sm text-text-subtle dark:text-text-dark-subtle">
              Complete as informações para acessar a plataforma de treinamento.
            </p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            onSubmit={handleSignup}
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

            <div>
              <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wide text-text-subtle dark:text-text-dark-subtle">
                Nome completo
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border-light bg-background-light px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:border-border-dark dark:bg-[#2b3033]">
                <User className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-base text-text-DEFAULT placeholder:text-neutral-500 focus:outline-none dark:text-text-dark-DEFAULT"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>

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

            <div className="grid gap-6 sm:grid-cols-2">
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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-base text-text-DEFAULT placeholder:text-neutral-500 focus:outline-none dark:text-text-dark-DEFAULT"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wide text-text-subtle dark:text-text-dark-subtle">
                  Confirmar senha
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-border-light bg-background-light px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:border-border-dark dark:bg-[#2b3033]">
                  <Lock className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent text-base text-text-DEFAULT placeholder:text-neutral-500 focus:outline-none dark:text-text-dark-DEFAULT"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-subtle dark:text-text-dark-subtle">
                Foto de perfil (opcional)
              </span>
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-border-light bg-background-light px-4 py-3 text-sm font-medium text-text-subtle transition-colors hover:border-primary hover:text-text-DEFAULT dark:border-border-dark dark:bg-[#2b3033] dark:hover:border-primary">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border-light bg-card-light shadow-sm dark:border-border-dark dark:bg-card-dark">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Pré-visualização" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-neutral-500 dark:text-neutral-300" />
                    )}
                  </div>
                  <div className="text-left">
                    <p>{photoPreview ? 'Alterar foto selecionada' : 'Selecionar imagem'}</p>
                    <span className="text-xs text-text-subtle dark:text-text-dark-subtle">PNG ou JPG até 5MB</span>
                  </div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${renderRequirementClass(passwordRequirements.length)}`}>
                <Check className={`h-4 w-4 ${passwordRequirements.length ? 'text-green-600 dark:text-green-200' : 'text-neutral-400'}`} />
                Pelo menos 6 caracteres
              </div>
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${renderRequirementClass(passwordRequirements.uppercase)}`}>
                <Check className={`h-4 w-4 ${passwordRequirements.uppercase ? 'text-green-600 dark:text-green-200' : 'text-neutral-400'}`} />
                Uma letra maiúscula
              </div>
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${renderRequirementClass(passwordRequirements.lowercase)}`}>
                <Check className={`h-4 w-4 ${passwordRequirements.lowercase ? 'text-green-600 dark:text-green-200' : 'text-neutral-400'}`} />
                Uma letra minúscula
              </div>
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${renderRequirementClass(passwordRequirements.number)}`}>
                <Check className={`h-4 w-4 ${passwordRequirements.number ? 'text-green-600 dark:text-green-200' : 'text-neutral-400'}`} />
                Um número
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-text-subtle dark:text-text-dark-subtle">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="h-4 w-4 rounded border border-border-light text-primary focus:ring-primary focus:ring-offset-0 dark:border-border-dark"
              />
              <span>
                Eu concordo com os
                <a href="#" className="ml-1 font-semibold text-danger-color hover:text-red-600">Termos &amp; Condições</a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-danger-color px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? 'Criando conta...' : 'Criar conta'}
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
                Já tem uma conta?
              </span>
              <div className="h-px flex-1 bg-border-light dark:bg-border-dark"></div>
            </div>
            <p className="mt-4 text-sm text-text-subtle dark:text-text-dark-subtle">
              Faça o login para acessar a plataforma.
              <Link
                to="/login"
                className="ml-1 font-semibold text-danger-color transition-colors hover:text-red-600"
              >
                Entrar
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default Signup;
