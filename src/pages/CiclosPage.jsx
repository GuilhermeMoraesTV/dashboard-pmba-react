import React, { useState, useEffect } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

function CiclosPage({ user, addRegistroEstudo, onCicloAtivado, onStartStudy, activeCicloId, forceOpenVisual }) {
  // Inicializa selectedCicloId como null (garante CiclosList como default)
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  // Efeito para auto-navegação: APENAS usado para a transição imediata
  // após a criação de um ciclo (quando forceOpenVisual é true).
  useEffect(() => {
    if (forceOpenVisual && activeCicloId) {
      setSelectedCicloId(activeCicloId);
    }
  }, [forceOpenVisual, activeCicloId]);

  // Handler que será passado para CiclosList e CicloCreateWizard para forçar a visualização do detalhe.
  const handleCicloCreation = (id) => {
    // 1. Seta o estado local IMEDIATAMENTE (força a renderização do detalhe na mesma thread/render)
    setSelectedCicloId(id);

    // 2. Notifica o Dashboard para acionar o forceOpenVisual e o tutorial (se necessário).
    onCicloAtivado(id);
  };

  // --- CORREÇÃO DA VERIFICAÇÃO DE RENDERIZAÇÃO ---
  // Verifica se o selectedCicloId existe E é uma string válida
  if (selectedCicloId && typeof selectedCicloId === 'string') {
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user}
        addRegistroEstudo={addRegistroEstudo}
        onStartStudy={onStartStudy}
      />
    );
  } else {
    return (
      <CiclosList
        onCicloClick={(id) => setSelectedCicloId(id)}
        user={user}
        onCicloAtivado={handleCicloCreation}
      />
    );
  }
}

export default CiclosPage;