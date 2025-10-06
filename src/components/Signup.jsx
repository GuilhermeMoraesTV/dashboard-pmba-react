import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from "firebase/auth";

// A prop 'onSwitchMode' será uma função para nos levar de volta à tela de login
function Signup({ onSwitchMode }) {
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
      // O Firebase automaticamente faz o login do usuário após o cadastro.
      // O App.jsx vai detectar a mudança e mostrar o dashboard.
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
    // Usaremos as classes de estilo do Auth.css que criaremos a seguir
    <div className="auth-container">
      <div className="auth-card">
        <h2>Criar Conta</h2>
        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn btn-primary">
            Cadastrar
          </button>
        </form>
        <p className="switch-mode">
          Já tem uma conta? <button onClick={onSwitchMode}>Entrar</button>
        </p>
      </div>
    </div>
  );
}

export default Signup;