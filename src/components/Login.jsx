import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
// Importamos as duas funções: a de login e a de resetar senha
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import './Auth.css';

function Login({ onSwitchMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // Para mensagens de sucesso (como o envio do e-mail)

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

  // NOVA FUNÇÃO para lidar com a recuperação de senha
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
    <div className="auth-container">
      <div className="auth-card">
        <h2>Entrar no Dashboard</h2>
        <form onSubmit={handleLogin}>
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
          {message && <p style={{ color: 'var(--success-color)', fontSize: '0.9em' }}>{message}</p>}

          <button type="submit" className="btn btn-primary">
            Entrar
          </button>
        </form>

        {/* Links de ação abaixo do formulário */}
        <div className="switch-mode" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button onClick={handlePasswordReset} style={{ textAlign: 'left' }}>
            Esqueci minha senha
          </button>
          <button onClick={onSwitchMode} style={{ textAlign: 'right' }}>
            Cadastre-se
          </button>
        </div>

      </div>
    </div>
  );
}

export default Login;