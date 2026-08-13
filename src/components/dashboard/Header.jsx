import React, { useMemo, useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc, orderBy, limit } from 'firebase/firestore';

const dateToYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function Header({ user, activeTab, setActiveTab, variant = 'center' }) {
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Guerreiro';
  const showWelcome = activeTab === 'home';
  const [todayQuote, setTodayQuote] = useState(null);
  const isHomeRow = variant === 'home-row';

  // Busca a frase do dia: primeiro verifica destaque manual, depois busca por scheduledDate
  useEffect(() => {
    const todayStr = dateToYMD(new Date());

    // 1. Ouve destaque manual em quotes_settings
    const unsubSettings = onSnapshot(doc(db, 'system_config', 'quotes_settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.featuredDate === todayStr && data.featuredText) {
          setTodayQuote({ text: data.featuredText, author: data.featuredAuthor || '' });
          return;
        }
      }
      // 2. Sem destaque manual — busca frase agendada para hoje
      setTodayQuote(null); // reseta para que a query abaixo assuma
    });

    // 3. Busca frase com scheduledDate === hoje
    const q = query(
      collection(db, 'system_quotes'),
      where('scheduledDate', '==', todayStr),
      limit(1)
    );
    const unsubQuote = onSnapshot(q, (snap) => {
      // só aplica se não há destaque manual ativo
      if (snap.empty) return;
      const data = snap.docs[0].data();
      setTodayQuote(prev => {
        // mantém destaque manual se já setado pelo unsubSettings
        if (prev && prev._isManual) return prev;
        return { text: data.text, author: data.author || '' };
      });
    });

    return () => {
      unsubSettings();
      unsubQuote();
    };
  }, []);

  // Ouve destaque manual em tempo real e marca com _isManual para prioridade
  useEffect(() => {
    const todayStr = dateToYMD(new Date());
    const unsub = onSnapshot(doc(db, 'system_config', 'quotes_settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.featuredDate === todayStr && data.featuredText) {
          setTodayQuote({ text: data.featuredText, author: data.featuredAuthor || '', _isManual: true });
        }
        // Se não há destaque manual, deixa a frase agendada assumir (não reseta)
      }
    });
    return () => unsub();
  }, []);

  const headerData = useMemo(() => {
    const date = new Date();
    const hour = date.getHours();

    let greeting = 'Olá';
    if (hour >= 5 && hour < 12) greeting = 'Bom dia';
    else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = date.toLocaleDateString('pt-BR', options);
    const dateFormatted = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    return { greeting, dateFormatted };
  }, []);

  if (!showWelcome) return null;

  return (
    <header className={isHomeRow ? 'w-full animate-fade-in' : 'w-full mb-6 pt-4 md:pt-0 animate-fade-in px-4 md:px-0'}>
      <div className={`flex flex-col gap-2 ${isHomeRow ? 'items-start text-left justify-start' : 'items-center text-center justify-center'}`}>

        {/* BLOCO SUPERIOR: DATA E SAUDAÇÃO */}
        <div
          onClick={() => setActiveTab && setActiveTab('home')}
          className={`flex flex-col gap-0.5 cursor-pointer hover:opacity-70 transition-opacity select-none group/logo ${isHomeRow ? 'items-start' : 'items-center'}`}
          title="Voltar para o Início"
        >
          <span className="text-[9px] md:text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500 group-hover/logo:text-red-500 transition-colors">
            {headerData.dateFormatted}
          </span>
          <h1 className={`${isHomeRow ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-1.5`}>
            {headerData.greeting}, {firstName}
            <span className="animate-wave origin-bottom-right inline-block text-lg"></span>
          </h1>
        </div>

        {/* BLOCO DA FRASE — só renderiza se houver frase cadastrada para hoje */}
        {todayQuote && (
          <div className={`relative group mt-1 w-full ${isHomeRow ? 'max-w-xl' : 'max-w-2xl'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 rounded-xl opacity-60 blur-sm transform scale-95 group-hover:scale-100 transition-all duration-700"></div>

            <div className="relative border border-zinc-200 dark:border-zinc-800/50
                          bg-gradient-to-b from-white to-zinc-50 dark:from-card-dark dark:to-card-dark
                          rounded-xl p-3 flex flex-col gap-1.5
                          transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5">

              <Quote size={14} className={`text-zinc-400 dark:text-zinc-700 fill-current mb-[-2px] ${isHomeRow ? 'self-start' : 'self-center'}`} />

              <div className={`flex flex-col gap-1 relative z-10 w-full ${isHomeRow ? 'items-start' : 'items-center'}`}>
                <p className={`text-xs md:text-sm font-bold text-zinc-700 dark:text-zinc-200 italic leading-snug px-2 ${isHomeRow ? 'text-left' : 'text-center'}`}>
                  "{todayQuote.text}"
                </p>
                {todayQuote.author && (
                  <div className="flex items-center gap-2 mt-0.5 opacity-80">
                    <span className="h-px w-3 bg-red-400/40"></span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                      {todayQuote.author}
                    </span>
                    <span className="h-px w-3 bg-red-400/40"></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      {!isHomeRow && (
        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent mt-6 opacity-60" />
      )}
    </header>
  );
}

export default Header;
