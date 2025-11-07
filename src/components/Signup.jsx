import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
  </svg>
);

const IconLoader = () => (
  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const navigate = useNavigate();

  const passwordRequirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordRequirements).every((req) => req);
  const passwordRequirementDetails = [
    { key: 'length', label: 'Mínimo de 6 caracteres' },
    { key: 'uppercase', label: 'Ao menos uma letra maiúscula' },
    { key: 'lowercase', label: 'Ao menos uma letra minúscula' },
    { key: 'number', label: 'Ao menos um número' },
  ];

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

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

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let photoURL = null;

      if (photo) {
        const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
        const snapshot = await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      await updateProfile(user, {
        displayName: name,
        photoURL: photoURL,
      });

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        name: name,
        email: email,
        photoURL: photoURL,
        createdAt: serverTimestamp(),
      });

      setLoading(false);
      navigate('/');
    } catch (err) {
      setLoading(false);
      console.error('Erro no cadastro:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está sendo utilizado.');
      } else {
        setError('Falha ao criar a conta. Tente novamente.');
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 lg:px-12">
      <div className="w-full max-w-6xl grid items-stretch gap-10 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, x: -80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative hidden lg:flex lg:col-span-2"
        >
          <div className="custom-card relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1c1c21] via-[#101014] to-[#050506] text-white shadow-2xl">
            <div className="absolute -top-16 -left-20 h-36 w-36 rotate-12 rounded-2xl border border-primary-dark bg-primary-dark"></div>
            <div className="absolute top-28 -left-8 h-16 w-16 rotate-45 border border-primary-light"></div>
            <div className="absolute bottom-10 -right-16 h-48 w-48 rotate-12 rounded-3xl border border-[#361313] bg-[#250d0d]"></div>
            <div className="relative z-10">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-light">Cadastro PMBA</span>
              <h1 className="mt-6 text-3xl font-extrabold leading-tight">
                Construa uma trajetória tática desde o primeiro acesso
              </h1>
              <p className="mt-4 text-sm text-zinc-300">
                Uma experiência sólida, moderna e inspirada no campo operacional para configurar o seu painel militar em minutos.
              </p>
            </div>
            <div className="relative z-10 mt-8 space-y-5">
              <div className="flex gap-4 rounded-2xl border border-[#2b2b30] bg-[#151519] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold">1</div>
                <div>
                  <p className="text-lg font-semibold text-white">Cadastre-se com identidade profissional</p>
                  <p className="text-sm text-zinc-400">Insira seus dados, personalize com foto e mantenha tudo sincronizado.</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-2xl border border-[#2b2b30] bg-[#151519] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold">2</div>
                <div>
                  <p className="text-lg font-semibold text-white">Defina metas e ciclos estratégicos</p>
                  <p className="text-sm text-zinc-400">Estruture disciplinas, metas semanais e acompanhamentos detalhados.</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-2xl border border-[#2b2b30] bg-[#151519] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold">3</div>
                <div>
                  <p className="text-lg font-semibold text-white">Monitore resultados em tempo real</p>
                  <p className="text-sm text-zinc-400">Dashboards sólidos, sem transparências, com foco em performance.</p>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-10 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-zinc-500">
              <img src="/logo-pmba.png" alt="Logo PMBA" className="h-10 w-10 rounded-lg border border-[#2d2d30] bg-[#1a1a1d] object-contain p-2" />
              <span>Pronto para evoluir diariamente</span>
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
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-light">Crie sua conta</span>
                <h2 className="mt-3 text-3xl font-extrabold text-text-heading dark:text-text-dark-heading">
                  Bem-vindo ao painel tático da PMBA
                </h2>
                <p className="mt-2 text-sm text-text-subtle dark:text-text-dark-subtle">
                  Registre-se para desbloquear ciclos, metas e indicadores estratégicos em um ambiente profissional.
                </p>
              </div>
              <div className="hidden sm:block">
                <img src="/logo-pmba.png" alt="Escudo PMBA" className="h-16 w-16 rounded-xl border border-border-light dark:border-border-dark bg-card-light p-3 dark:bg-[#131316]" />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 rounded-lg border border-red-600 bg-red-200 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
              >
                {error}
              </motion.div>
            )}

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              onSubmit={handleSignup}
              className="mt-8 space-y-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:text-text-dark-subtle">
                    Nome completo
                  </label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-subtle transition-colors group-focus-within:text-primary-light dark:text-text-dark-subtle">
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
                      className="w-full rounded-lg border border-border-light bg-card-light p-3.5 pl-12 text-text-DEFAULT placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-[#131316] dark:text-white dark:placeholder:text-text-dark-subtle"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>
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
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:text-text-dark-subtle">
                  Foto de perfil (opcional)
                </span>
                <label
                  htmlFor="photo"
                  className="mt-2 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-border-light bg-card-light px-4 py-3 transition-colors hover:border-primary dark:border-border-dark dark:bg-[#131316]"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Pré-visualização" className="h-16 w-16 rounded-xl border border-primary object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-white">
                      <IconCamera />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-text-heading dark:text-text-dark-heading">Selecionar arquivo</p>
                    <p className="text-xs text-text-subtle dark:text-text-dark-subtle">PNG ou JPG até 5 MB.</p>
                  </div>
                </label>
                <input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border-light bg-card-light p-3.5 pl-12 text-text-DEFAULT placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-[#131316] dark:text-white dark:placeholder:text-text-dark-subtle"
                      placeholder="Crie uma senha segura"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-text-subtle dark:text-text-dark-subtle">
                    Confirmar senha
                  </label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-text-subtle transition-colors group-focus-within:text-primary-light dark:text-text-dark-subtle">
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
                      className="w-full rounded-lg border border-border-light bg-card-light p-3.5 pl-12 text-text-DEFAULT placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-[#131316] dark:text-white dark:placeholder:text-text-dark-subtle"
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-[#131316]">
                <h3 className="text-sm font-semibold text-text-heading dark:text-text-dark-heading uppercase tracking-[0.25em]">
                  Sua senha precisa conter
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {passwordRequirementDetails.map((item) => {
                    const satisfied = passwordRequirements[item.key];
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                          satisfied
                            ? 'border-green-600 bg-green-200 text-green-900 dark:border-green-600 dark:bg-green-950 dark:text-green-200'
                            : 'border-border-light bg-card-light text-text-subtle dark:border-border-dark dark:bg-[#19191d] dark:text-text-dark-subtle'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                            satisfied
                              ? 'bg-green-600 text-white'
                              : 'bg-border-light text-text-subtle dark:bg-[#1f1f24] dark:text-text-dark-subtle'
                          }`}
                        >
                          {satisfied ? <IconCheck /> : '•'}
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-[#131316]">
                <label className="flex items-start gap-3 text-sm text-text-subtle dark:text-text-dark-subtle">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-border-light bg-card-light text-primary focus:ring-primary focus:ring-offset-0 dark:border-border-dark dark:bg-[#1f1f24]"
                  />
                  <span>
                    Eu li e concordo com os <span className="font-semibold text-primary">Termos &amp; Condições</span> e a <span className="font-semibold text-primary">Política de Privacidade</span>.
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-primary px-5 py-3 text-sm font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? <IconLoader /> : null}
                    {loading ? 'Criando conta...' : 'Criar conta'}
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
                Já possui acesso?
                <Link to="/login" className="ml-2 font-semibold uppercase tracking-[0.2em] text-primary hover:text-primary-light">
                  Faça login
                </Link>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Signup;
