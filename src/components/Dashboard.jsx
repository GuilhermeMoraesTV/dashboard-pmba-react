import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from "firebase/auth";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";

import NavSidebar from "./dashboard/dashboard/NavSidebar.jsx";
import Header from './dashboard/Header.jsx';
import Home from './dashboard/Home.jsx';
import QuestionsTab from './dashboard/QuestionsTab.jsx';
import HoursTab from './dashboard/HoursTab.jsx';
import GoalsTab from './dashboard/GoalsTab.jsx';
import CalendarTab from './dashboard/CalendarTab.jsx';
import DayDetailsModal from './dashboard/DayDetailsModal.jsx';

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [questionsData, setQuestionsData] = useState([]);
  const [hoursData, setHoursData] = useState([]);
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayModalData, setDayModalData] = useState(null);

  // Efeito para buscar todos os dados
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const questionsRef = collection(db, "users", user.uid, "questoes");
        const questionsSnapshot = await getDocs(questionsRef);
        setQuestionsData(questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const hoursRef = collection(db, "users", user.uid, "horas");
        const hoursSnapshot = await getDocs(hoursRef);
        setHoursData(hoursSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const goalsRef = collection(db, "users", user.uid, "metas");
        const goalsSnapshot = await getDocs(goalsRef);
        const goalsData = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Se não houver metas, cria uma meta padrão
        if (goalsData.length === 0) {
          const defaultGoal = { questions: 0, hours: 0, startDate: '2020-01-01' };
          const docRef = await addDoc(collection(db, "users", user.uid, "metas"), defaultGoal);
          setGoalsHistory([{ id: docRef.id, ...defaultGoal }]);
        } else {
          setGoalsHistory(goalsData);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Efeitos para o tema
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
     else setIsDarkMode(true);
  }, []);

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error("Erro no logout:", error));
  };

  // Funções para adicionar/deletar questões
  const handleAddQuestion = async (newQuestion) => {
    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "questoes"), newQuestion);
      setQuestionsData([...questionsData, { id: docRef.id, ...newQuestion }]);
    } catch (error) {
      console.error("Erro ao adicionar questão:", error);
    }
  };

  const handleDeleteQuestion = async (id) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "questoes", id));
      setQuestionsData(questionsData.filter(q => q.id !== id));
    } catch (error) {
      console.error("Erro ao deletar questão:", error);
    }
  };

  // Funções para adicionar/deletar horas
  const handleAddHour = async (newHour) => {
    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "horas"), newHour);
      setHoursData([...hoursData, { id: docRef.id, ...newHour }]);
    } catch (error) {
      console.error("Erro ao adicionar hora:", error);
    }
  };

  const handleDeleteHour = async (id) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "horas", id));
      setHoursData(hoursData.filter(h => h.id !== id));
    } catch (error) {
      console.error("Erro ao deletar hora:", error);
    }
  };

  // Funções para salvar/deletar metas
  const handleSaveGoal = async (goalData) => {
    try {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = dateToYMD_local(new Date(today.setDate(diff)));

      const existingGoal = goalsHistory.find(g => g.startDate === startOfWeek);

      if (existingGoal) {
        await setDoc(doc(db, "users", user.uid, "metas", existingGoal.id), {
          ...goalData,
          startDate: startOfWeek
        });
        setGoalsHistory(goalsHistory.map(g =>
          g.id === existingGoal.id ? { ...g, ...goalData } : g
        ));
      } else {
        const docRef = await addDoc(collection(db, "users", user.uid, "metas"), {
          ...goalData,
          startDate: startOfWeek
        });
        setGoalsHistory([...goalsHistory, { id: docRef.id, ...goalData, startDate: startOfWeek }]);
      }
      alert('Meta salva com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
      alert('Erro ao salvar meta.');
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "metas", id));
      setGoalsHistory(goalsHistory.filter(g => g.id !== id));
    } catch (error) {
      console.error("Erro ao deletar meta:", error);
    }
  };

  // Função para abrir modal de detalhes do dia
  const handleDayClick = (date) => {
    const dayQuestions = questionsData.filter(d => d.date === date);
    const dayHours = hoursData.filter(d => d.date === date);
    setSelectedDay(date);
    setDayModalData({ dayQuestions, dayHours });
  };

  // Função que decide qual página/conteúdo mostrar
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home
                  questionsData={questionsData}
                  hoursData={hoursData}
                  goalsHistory={goalsHistory}
                  setActiveTab={setActiveTab}
                  onDayClick={handleDayClick}
                />;
      case 'questions':
        return <QuestionsTab
                  questionsData={questionsData}
                  onAddQuestion={handleAddQuestion}
                  onDeleteQuestion={handleDeleteQuestion}
                />;
      case 'hours':
        return <HoursTab
                  hoursData={hoursData}
                  onAddHour={handleAddHour}
                  onDeleteHour={handleDeleteHour}
                />;
      case 'goals':
        return <GoalsTab
                  goalsHistory={goalsHistory}
                  onSaveGoal={handleSaveGoal}
                  onDeleteGoal={handleDeleteGoal}
                />;
      case 'goals-history':
        return <CalendarTab
                  questionsData={questionsData}
                  hoursData={hoursData}
                  goalsHistory={goalsHistory}
                  onDayClick={handleDayClick}
                />;
      default:
        return <Home
                  questionsData={questionsData}
                  hoursData={hoursData}
                  goalsHistory={goalsHistory}
                  setActiveTab={setActiveTab}
                  onDayClick={handleDayClick}
                />;
    }
  };

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '50px'}}>Carregando...</div>;
  }

  return (
    <div className="app-layout">
      <NavSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content-area">
        <Header
          user={user}
          handleLogout={handleLogout}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
        {renderContent()}
      </main>
      {selectedDay && dayModalData && (
        <DayDetailsModal
          date={selectedDay}
          dayData={dayModalData}
          onClose={() => {
            setSelectedDay(null);
            setDayModalData(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;