import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, authPersistenceReady, db } from './firebaseConfig';
import PwaStatus from './components/shared/PwaStatus';
import { dismissInitialLoadingScreen } from './utils/initialLoadingScreen';
import {
  applyUserFontSize,
  DEFAULT_USER_FONT_SIZE,
  normalizeUserFontSize,
  USER_FONT_SIZE_STORAGE_KEY,
} from './utils/userFontPreference';

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

  useEffect(() => {
    if (!user) dismissInitialLoadingScreen();
  }, [user]);

  return user ? <Navigate to={destination} replace /> : children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userFontSize, setUserFontSize] = useState(() => {
    return normalizeUserFontSize(localStorage.getItem(USER_FONT_SIZE_STORAGE_KEY));
  });

  // --- Lógica de Zoom do Sistema ---
  useEffect(() => {
    const handleResize = () => {
      applyUserFontSize(userFontSize);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userFontSize]);

  useEffect(() => {
    if (!user?.uid) {
      const storedFontSize = normalizeUserFontSize(localStorage.getItem(USER_FONT_SIZE_STORAGE_KEY));
      setUserFontSize(storedFontSize);
      return undefined;
    }

    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'uiPreferences'), (snapshot) => {
      const nextFontSize = normalizeUserFontSize(
        snapshot.exists()
          ? snapshot.data()?.fontSize
          : DEFAULT_USER_FONT_SIZE,
      );
      localStorage.setItem(USER_FONT_SIZE_STORAGE_KEY, nextFontSize);
      setUserFontSize(nextFontSize);
    }, (error) => {
      console.warn('[Preferencias] Nao foi possivel carregar tamanho da fonte:', error);
      setUserFontSize(normalizeUserFontSize(localStorage.getItem(USER_FONT_SIZE_STORAGE_KEY)));
    });
  }, [user?.uid]);

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
    let unsubscribe = () => {};
    let active = true;

    authPersistenceReady.finally(() => {
      if (!active) return;
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser?.uid) {
          const themeInitializedKey = `modoqap_initial_theme_${currentUser.uid}`;
          const createdAt = Date.parse(currentUser.metadata?.creationTime || '');
          const lastSignInAt = Date.parse(currentUser.metadata?.lastSignInTime || '');
          const isFirstSignIn = Number.isFinite(createdAt)
            && Number.isFinite(lastSignInAt)
            && Math.abs(lastSignInAt - createdAt) <= 5000;

          if (isFirstSignIn && localStorage.getItem(themeInitializedKey) !== 'true') {
            localStorage.setItem(themeInitializedKey, 'true');
            setIsDarkMode(false);
          }
        }
        setUser(currentUser);
        setLoading(false);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return null;
  }

  return (
    <BrowserRouter>
      {/* ESTRUTURA DE LAYOUT:
          - 'flex flex-col min-h-screen' garante que o container ocupe toda a altura.
          - 'flex-grow' no Suspense/Main empurra o Footer para o final.
      */}
      <div className="flex flex-col min-h-screen bg-background-color dark:bg-dark-background-color transition-colors">
        <PwaStatus />

        <Suspense fallback={null}>
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
                element={<PublicRoute user={user}><Signup onSetLightTheme={() => setIsDarkMode(false)} /></PublicRoute>}
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
