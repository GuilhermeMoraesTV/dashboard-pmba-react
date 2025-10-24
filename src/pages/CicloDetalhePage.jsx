import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import CicloVisual from '../components/ciclos/CicloVisual';

const IconArrowLeft = () => <span>←</span>;

function CicloDetalhePage({ cicloId, onBack, user }) {
  const [ciclo, setCiclo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !cicloId) return;

    setLoading(true);
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);

    const unsubscribe = onSnapshot(cicloRef, (doc) => {
      if (doc.exists()) {
        setCiclo({ id: doc.id, ...doc.data() });
      } else {
        console.error("Ciclo não encontrado!");
        setCiclo(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar ciclo:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, cicloId]);

  if (loading) {
    return <div className="p-6 text-text-color dark:text-dark-text-color">Carregando dados do ciclo...</div>;
  }

  if (!ciclo) {
    return <div className="p-6 text-danger-color">Ciclo não encontrado.</div>;
  }

  return (
    <div className="p-0">
      {/* --- CABEÇALHO --- */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-primary-color hover:brightness-125 mb-1 font-semibold"
          >
            <IconArrowLeft />
            Voltar para Meus Ciclos
          </button>
          <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color">
            {ciclo.nome}
          </h1>
        </div>
        {/* Futuro botão de "Registrar Estudo" pode ir aqui */}
        <button
          className="px-5 py-3 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all"
        >
          + Registrar Estudo
        </button>
      </div>

      {/* --- LAYOUT DA PÁGINA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna 1, 2 e 3: A Roda (Ciclo Visual) - "Bem maior" */}
        <div className="lg:col-span-3 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          {/* O componente agora busca seu próprio progresso */}
          <CicloVisual cicloId={ciclo.id} user={user} />
        </div>

        {/* Outros painéis (agora ficam abaixo da roda) */}
        <div className="lg:col-span-1 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">Tópicos do Ciclo</h2>
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color">(Em breve: Aqui ficará a lista de tópicos para estudar)</p>
        </div>
        <div className="lg:col-span-2 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">Estatísticas do Ciclo</h2>
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color">(Em breve: Gráficos de desempenho deste ciclo)</p>
        </div>

      </div>
    </div>
  );
}

export default CicloDetalhePage;