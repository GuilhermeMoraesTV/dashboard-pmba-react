import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import Dashboard from './components/Dashboard.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '50px'}}>Carregando...</div>;
  }

  if (!user) {
    return isLoginView
      ? <Login onSwitchMode={() => setIsLoginView(false)} />
      : <Signup onSwitchMode={() => setIsLoginView(true)} />;
  }

  // Passamos a informação do 'user' para o Dashboard
  return <Dashboard user={user} />;
}

export default App;