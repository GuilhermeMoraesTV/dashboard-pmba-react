import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from "firebase/auth";
// import './Auth.css'; // REMOVIDO!

// A prop onSwitchMode foi removida
function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else {
        setError('Ocorreu um erro ao criar a conta.');
      }
      console.error("Erro de cadastro:", err);
    }
  };

  return (
    // TRADUÇÃO de .auth-container
    <div className="flex items-center justify-center min-h-screen p-6 bg-background-color dark:bg-dark-background-color">
      {/* TRADUÇÃO de .auth-card */}
      <div className="w-full max-w-md px-8 py-10 bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow text-center">
        <h2 className="mt-0 mb-6 text-2xl font-bold text-heading-color dark:text-dark-heading-color border-none">
          Criar Conta
        </h2>
        <form onSubmit={handleSignup}>
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

          {/* TRADUÇÃO de .btn .btn-primary */}
          <button
            type="submit"
            className="w-full p-3 mt-2 border-none rounded-lg cursor-pointer font-semibold text-base
                       transition-opacity duration-200 transform active:scale-[0.98]
                       bg-primary-color text-white hover:opacity-90"
          >
            Cadastrar
          </button>
        </form>

        {/* TRADUÇÃO de .switch-mode */}
        <p className="mt-5 text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
          Já tem uma conta?
          {/* Botão trocado por um Link de Rota */}
          <a href="/login" className="ml-1 bg-transparent border-none text-primary-color font-semibold cursor-pointer p-0 underline">
            Entrar
          </a>
        </p>
      </div>
    </div>
  );
}

export default Signup;