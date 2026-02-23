import React, { useState } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

// Recebemos a prop 'logoCalculada' vinda do Manager
const UniversalGCMSeeder = ({ isInstalled, onSuccess, editalData, logoCalculada }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    const msg = isInstalled
      ? `Deseja REINSTALAR (Resetando) o edital ${editalData.titulo}?`
      : `Deseja INSTALAR o edital ${editalData.titulo}?`;

    if(!window.confirm(msg)) return;

    setLoading(true);
    try {
        // AQUI ESTÁ O SEGREDO:
        // Misturamos os dados do arquivo JSON com a logo que o Manager decidiu
        const payload = {
            ...editalData,
            logoUrl: logoCalculada // Forçamos a logo calculada a ser salva no banco
        };

        await setDoc(doc(db, "editais_templates", editalData.id), payload);
        alert(`Edital ${editalData.titulo} instalado com sucesso!`);
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
        onClick={handleSeed}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
            isInstalled
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default UniversalGCMSeeder;