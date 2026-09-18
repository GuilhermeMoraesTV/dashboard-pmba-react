import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, authPersistenceReady, db, isFirebaseEmulator } from './firebaseConfig';
import PwaStatus from './components/shared/PwaStatus';
import EnvironmentBadge from './components/shared/EnvironmentBadge';
import { dismissInitialLoadingScreen } from './utils/initialLoadingScreen';
import {
  applyUserFontSize,
  DEFAULT_USER_FONT_SIZE,
  normalizeUserFontSize,
  USER_FONT_SIZE_STORAGE_KEY,
} from './utils/userFontPreference';
import { lazyWithRetry } from './utils/lazyWithRetry';
import {
  clearPendingEmulatorLogin,
  mirrorFirebaseUserToEmulator,
  readEmulatorSessionIdentity,
  readPendingEmulatorLogin,
  writeEmulatorSessionIdentity,
} from './utils/firebaseEnvironment.js';

// Importações Lazy
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'), { name: 'Dashboard' });
const Login = lazyWithRetry(() => import('./components/Login'), { name: 'Login' });
const Signup = lazyWithRetry(() => import('./components/Signup'), { name: 'Cadastro' });
const ForgotPassword = lazyWithRetry(() => import('./components/ForgotPassword'), { name: 'Recuperar Senha' });
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), { name: 'Página Não Encontrada' });
const SubscriptionTestPanel = import.meta.env.DEV
  ? lazyWithRetry(() => import('./components/dev/SubscriptionTestPanel'), { name: 'SubscriptionTestPanel' })
  : null;

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

  // --- Recuperação automática de chunks desatualizados ---
  useEffect(() => {
    const handlePreloadError = (event) => {
      console.warn('[Vite] Erro de preload de módulo detectado, recarregando página...', event);
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', handlePreloadError);
    return () => window.removeEventListener('vite:preloadError', handlePreloadError);
  }, []);

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

    authPersistenceReady.finally(async () => {
      if (!active) return;
      if (isFirebaseEmulator) {
        const pendingLogin = readPendingEmulatorLogin(window.sessionStorage);
        const sessionIdentity = readEmulatorSessionIdentity(window.sessionStorage);
        if (pendingLogin || sessionIdentity) {
          try {
            const identity = pendingLogin || sessionIdentity;
            const restored = await mirrorFirebaseUserToEmulator({
              uid: identity.uid,
              email: identity.email,
              localPassword: pendingLogin?.password,
              restoreOnly: true,
            });
            await signInWithEmailAndPassword(auth, restored.email, restored.password);
            writeEmulatorSessionIdentity(window.sessionStorage, restored);
            clearPendingEmulatorLogin(window.sessionStorage);
          } catch (error) {
            clearPendingEmulatorLogin(window.sessionStorage);
            console.warn('[Firebase Emulator] Sessão local expirada; faça login novamente:', error?.code || error?.message);
          }
        }
      }
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
    return <EnvironmentBadge />;
  }

  return (
    <BrowserRouter>
      {/* ESTRUTURA DE LAYOUT:
          - 'flex flex-col min-h-screen' garante que o container ocupe toda a altura.
          - 'flex-grow' no Suspense/Main empurra o Footer para o final.
      */}
      <div className="flex flex-col min-h-screen bg-background-color dark:bg-dark-background-color transition-colors">
        <PwaStatus />
        <EnvironmentBadge />
        {SubscriptionTestPanel && (
          <Suspense fallback={null}>
            <SubscriptionTestPanel user={user} />
          </Suspense>
        )}

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
