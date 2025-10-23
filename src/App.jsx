import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importações Lazy (boas para performance)
const Dashboard = lazy(() => import('./components/Dashboard'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- LÓGICA DO DARK MODE MOVIDA PARA CÁ ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Lê o tema do localStorage na inicialização
    return localStorage.getItem('theme') === 'dark';
  });

  // Efeito que aplica a classe 'dark' na tag <html>
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Função para alternar o tema
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };
  // --- FIM DA LÓGICA DO TEMA ---

  useEffect(() => {
    // Monitora a autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Limpa o listener ao desmontar
    return () => unsubscribe();
  }, []);

  if (loading) {
    // Tela de carregamento agora com Tailwind
    return (
      <div className="flex justify-center items-center min-h-screen bg-background-color dark:bg-dark-background-color">
        <h2 className="text-2xl font-semibold text-heading-color dark:text-dark-heading-color">
          Carregando...
        </h2>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          // Tela de carregamento para transição de rotas
          <div className="flex justify-center items-center min-h-screen bg-background-color dark:bg-dark-background-color">
            <h2 className="text-2xl font-semibold text-heading-color dark:text-dark-heading-color">
              Carregando...
            </h2>
          </div>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                // Esta é a linha 42 que estava dando erro
                <Dashboard
                  user={user}
                  isDarkMode={isDarkMode}
                  toggleTheme={toggleTheme}
                />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login />}
          />
          <Route
            path="/signup"
            element={user ? <Navigate to="/" /> : <Signup />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;