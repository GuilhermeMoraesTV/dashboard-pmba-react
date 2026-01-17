import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importações Lazy
const Dashboard = lazy(() => import('./components/Dashboard'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. Lógica de Zoom do Sistema (ADICIONADO AQUI) ---
  useEffect(() => {
    // Define a fonte base do HTML para 85% (aprox. 13.6px)
    // Como o Tailwind usa 'rem', isso diminui todo o sistema proporcionalmente.
    document.documentElement.style.fontSize = '85%';

    // Opcional: Garante que em celulares muito pequenos o texto não fique ilegível
    const handleResize = () => {
      if (window.innerWidth < 640) {
        document.documentElement.style.fontSize = '90%'; // Um pouco maior no mobile
      } else {
        document.documentElement.style.fontSize = '95%'; // Menor no desktop
      }
    };

    // Executa na montagem
    handleResize();

    // Adiciona listener se a tela mudar de tamanho
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // -----------------------------------------------------

  // Lógica do Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

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

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Monitoramento de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background-color dark:bg-dark-background-color">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-screen bg-background-color dark:bg-dark-background-color">
            <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-600 rounded-full animate-spin"></div>
          </div>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              user ? (
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
          <Route
            path="/forgot-password"
            element={user ? <Navigate to="/" /> : <ForgotPassword />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;