import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Importações Lazy
const Dashboard = lazy(() => import('./components/Dashboard'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function ProtectedDashboard({ user, isDarkMode, toggleTheme }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Dashboard user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
}

function PublicRoute({ user, children }) {
  const location = useLocation();
  const destination = location.state?.from?.pathname || '/app/home';
  return user ? <Navigate to={destination} replace /> : children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Lógica de Zoom do Sistema ---
  useEffect(() => {
    document.documentElement.style.fontSize = '85%';
    const handleResize = () => {
      if (window.innerWidth < 640) {
        document.documentElement.style.fontSize = '90%';
      } else {
        document.documentElement.style.fontSize = '95%';
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      {/* ESTRUTURA DE LAYOUT:
          - 'flex flex-col min-h-screen' garante que o container ocupe toda a altura.
          - 'flex-grow' no Suspense/Main empurra o Footer para o final.
      */}
      <div className="flex flex-col min-h-screen bg-background-color dark:bg-dark-background-color transition-colors">

        <Suspense
          fallback={
            <div className="flex flex-grow justify-center items-center">
              <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-600 rounded-full animate-spin"></div>
            </div>
          }
        >
          <main className="flex-grow">
            <Routes>
              <Route
                path="/"
                element={<ProtectedDashboard user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
              />
              <Route
                path="/app/:tab"
                element={<ProtectedDashboard user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
              />
              <Route
                path="/login"
                element={<PublicRoute user={user}><Login /></PublicRoute>}
              />
              <Route
                path="/signup"
                element={<PublicRoute user={user}><Signup /></PublicRoute>}
              />
              <Route
                path="/forgot-password"
                element={<PublicRoute user={user}><ForgotPassword /></PublicRoute>}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </Suspense>

      </div>
    </BrowserRouter>
  );
}

export default App;
