import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
// import './Auth.css'; // REMOVIDO! Não é mais necessário.

function Login() { // A prop onSwitchMode não estava sendo usada aqui, removi
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('E-mail ou senha inválidos.');
      console.error("Erro de login:", err);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail no campo acima para recuperar a senha.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err) {
      setError('Erro ao enviar e-mail. Verifique se o e-mail está correto.');
      console.error("Erro ao resetar senha:", err);
    }
  };

  return (
    // TRADUÇÃO de .auth-container
    <div className="flex items-center justify-center min-h-screen p-6 bg-background-color dark:bg-dark-background-color">
      {/* TRADUÇÃO de .auth-card */}
      <div className="w-full max-w-md px-8 py-10 bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow text-center">
        <h2 className="mt-0 mb-6 text-2xl font-bold text-heading-color dark:text-dark-heading-color border-none">
          Entrar no Dashboard
        </h2>
        <form onSubmit={handleLogin}>
          {/* TRADUÇÃO de .form-group */}
          <div className="mb-5 text-left">
            <label htmlFor="email" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              // TRADUÇÃO de .form-group input
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            />
          </div>
          <div className="mb-5 text-left">
            <label htmlFor="password" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            />
          </div>

          {/* TRADUÇÃO de .error-message */}
          {error && <p className="text-danger-color text-sm mb-4">{error}</p>}
          {message && <p className="text-success-color text-sm mb-4">{message}</p>}

          {/* TRADUÇÃO de .btn .btn-primary */}
          <button
            type="submit"
            className="w-full p-3 mt-2 border-none rounded-lg cursor-pointer font-semibold text-base
                       transition-opacity duration-200 transform active:scale-[0.98]
                       bg-primary-color text-white hover:opacity-90"
          >
            Entrar
          </button>
        </form>

        {/* TRADUÇÃO de .switch-mode e botões internos */}
        <div className="flex justify-between mt-5 text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
          <button
            onClick={handlePasswordReset}
            className="bg-transparent border-none text-primary-color font-semibold cursor-pointer p-0 underline text-left"
          >
            Esqueci minha senha
          </button>
          {/* Este botão agora não é mais necessário, pois o App.jsx cuida da rota */}
          {/* <button onClick={onSwitchMode} ... >Cadastre-se</button> */}
          {/* Vamos usar um Link do react-router-dom que é o jeito certo */}
          <a href="/signup" className="bg-transparent border-none text-primary-color font-semibold cursor-pointer p-0 underline text-right">
            Cadastre-se
          </a>
        </div>

      </div>
    </div>
  );
}

export default Login;