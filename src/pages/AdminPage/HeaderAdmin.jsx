import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  Lock, MessageSquare, Megaphone, Quote, Bug, FileText, Lightbulb, HelpCircle,
  Database, AlertTriangle, RefreshCw // <--- Novos ícones importados
} from 'lucide-react';

// Importação dos Modais
import HeaderOcorrencias from './HeaderOcorrencias';
import HeaderFrases from './HeaderFrases';
import HeaderBroadcast from './HeaderBroadcast';

// Recebendo a função onRecalculateStats via props
const HeaderAdmin = ({ onRecalculateStats }) => {
  const [showInbox, setShowInbox] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);

  // Estados para o Botão Secreto (Bala de Prata)
  const [recalcMode, setRecalcMode] = useState('idle'); // idle | confirm | loading
  const [counts, setCounts] = useState({ total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 });
  const [quotesCount, setQuotesCount] = useState(0);

  // Lógica do Botão Secreto
  const handleSecretClick = async () => {
    if (recalcMode === 'loading') return;

    if (recalcMode === 'idle') {
      // 1º Clique: Arma o botão
      setRecalcMode('confirm');
      // Desarma automaticamente após 3 segundos se não confirmar
      setTimeout(() => {
        setRecalcMode((prev) => prev === 'loading' ? 'loading' : 'idle');
      }, 3000);
    } else if (recalcMode === 'confirm') {
      // 2º Clique: Dispara a Bala de Prata
      setRecalcMode('loading');
      if (onRecalculateStats) {
        await onRecalculateStats();
      }
      setRecalcMode('idle');
    }
  };

  // Monitorar Ocorrências Pendentes
  useEffect(() => {
    const q = query(collection(db, 'system_feedback'), where('status', '==', 'pendente'));
    const unsub = onSnapshot(q, (snap) => {
      let newCounts = { total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 };
      snap.docs.forEach(doc => {
        const data = doc.data();
        newCounts.total++;
        if (data.type) {
          const type = data.type.toLowerCase();
          if (newCounts[type] !== undefined) newCounts[type]++;
        }
      });
      setCounts(newCounts);
    });
    return () => unsub();
  }, []);

  // Monitorar Total de Frases
  useEffect(() => {
    const q = query(collection(db, 'system_quotes'));
    const unsub = onSnapshot(q, (snap) => setQuotesCount(snap.size));
    return () => unsub();
  }, []);

  return (
    <>
      <HeaderOcorrencias isOpen={showInbox} onClose={() => setShowInbox(false)} />
      <HeaderBroadcast isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} />
      <HeaderFrases isOpen={showQuotes} onClose={() => setShowQuotes(false)} />

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-40 pt-4 px-4 md:px-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-600/20 cursor-default select-none">
              <Lock size={10} /> Admin Zone
            </div>

            {/* --- BOTÃO SECRETO (BALA DE PRATA) --- */}
            {/* Só aparece se a função for passada */}
            {onRecalculateStats && (
              <button
                onClick={handleSecretClick}
                className={`
                  ml-1 p-1.5 rounded-lg transition-all duration-300
                  ${recalcMode === 'idle' ? 'text-zinc-300 dark:text-zinc-800 hover:text-zinc-400 dark:hover:text-zinc-700 opacity-50 hover:opacity-100' : ''}
                  ${recalcMode === 'confirm' ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse' : ''}
                  ${recalcMode === 'loading' ? 'bg-blue-500 text-white cursor-wait' : ''}
                `}
                title={recalcMode === 'idle' ? "Recalibrar Sistema (Duplo Clique)" : recalcMode === 'confirm' ? "CONFIRMAR RECÁLCULO?" : "Processando..."}
              >
                {recalcMode === 'idle' && <Database size={12} />}
                {recalcMode === 'confirm' && <AlertTriangle size={12} strokeWidth={3} />}
                {recalcMode === 'loading' && <RefreshCw size={12} className="animate-spin" />}
              </button>
            )}
            {/* ------------------------------------- */}

          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
            Painel de Controle <span className="text-red-600">.</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão Ocorrências */}
          <div className="relative group">
            <button onClick={() => setShowInbox(true)} className="relative flex items-center gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-lg hover:shadow-red-900/10 transition-all active:scale-95">
              <div className="relative">
                <MessageSquare size={18} className="group-hover:text-red-600 transition-colors" />
                {counts.total > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] text-white font-black items-center justify-center border-2 border-white dark:border-zinc-900">{counts.total > 9 ? '9+' : counts.total}</span>
                  </span>
                )}
              </div>
              <span className="hidden sm:inline group-hover:text-red-600 transition-colors">Ocorrências</span>
            </button>
            {/* Dropdown de Ocorrências (Mantido igual) */}
            {counts.total > 0 && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all transform origin-top-right z-50">
                <p className="text-[10px] font-bold uppercase text-zinc-400 px-2 mb-1 tracking-widest">Pendentes</p>
                <div className="space-y-1">
                  {counts.bug > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold"><span className="flex items-center gap-1"><Bug size={12} /> Bugs</span><span>{counts.bug}</span></div>}
                  {counts.edital > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-bold"><span className="flex items-center gap-1"><FileText size={12} /> Editais</span><span>{counts.edital}</span></div>}
                  {counts.ideia > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold"><span className="flex items-center gap-1"><Lightbulb size={12} /> Ideias</span><span>{counts.ideia}</span></div>}
                  {counts.duvida > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold"><span className="flex items-center gap-1"><HelpCircle size={12} /> Dúvidas</span><span>{counts.duvida}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Botão Frases */}
          <button
            onClick={() => setShowQuotes(true)}
            className="relative flex items-center gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold hover:border-violet-200 dark:hover:border-violet-900/50 hover:shadow-lg hover:text-violet-600 dark:hover:text-violet-400 transition-all active:scale-95 group"
          >
            <Quote size={18} className="group-hover:text-violet-500 transition-colors" />
            <span className="hidden sm:inline">Frases</span>
            {quotesCount > 0 && (
              <span className="ml-0.5 text-[10px] font-black text-violet-500 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-md border border-violet-200 dark:border-violet-800/40">
                {quotesCount}
              </span>
            )}
          </button>

          {/* Botão Broadcast */}
          <button
            onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
          >
            <Megaphone size={18} /> <span className="hidden sm:inline">Broadcast</span>
          </button>
        </div>
      </header>
    </>
  );
};

export default HeaderAdmin;