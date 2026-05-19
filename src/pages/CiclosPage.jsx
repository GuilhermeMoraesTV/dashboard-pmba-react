import React, { useState, useEffect } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

// AQUI: Recebe 'registrosEstudo' do Dashboard
function CiclosPage({ user, addRegistroEstudo, deleteCompletionRegistro, onCicloAtivado, onStartStudy, activeCicloId, forceOpenVisual, targetOpenCicloId, onTargetOpenHandled, onGoToEdital, registrosEstudo, isTimerActive }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  useEffect(() => {
    const cicloIdParaAbrir = targetOpenCicloId || activeCicloId;
    if (forceOpenVisual && cicloIdParaAbrir) {
      setSelectedCicloId(cicloIdParaAbrir);
      if (targetOpenCicloId) onTargetOpenHandled?.();
    }
  }, [forceOpenVisual, activeCicloId, targetOpenCicloId, onTargetOpenHandled]);

  const handleCicloCreation = (id) => {
    setSelectedCicloId(id);
    onCicloAtivado(id);
  };

  if (selectedCicloId && typeof selectedCicloId === 'string') {
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user}
        addRegistroEstudo={addRegistroEstudo}
        deleteCompletionRegistro={deleteCompletionRegistro}
        onStartStudy={onStartStudy}
        onGoToEdital={onGoToEdital}
      />
    );
  } else {
    return (
      <CiclosList
        onCicloClick={(id) => setSelectedCicloId(id)}
        user={user}
        onCicloAtivado={handleCicloCreation}
        registrosEstudo={registrosEstudo}
        isTimerActive={isTimerActive}
      />
    );
  }
}

export default CiclosPage;
