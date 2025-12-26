import React, { useState, useEffect } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

// AQUI: Recebe 'registrosEstudo' do Dashboard
function CiclosPage({ user, addRegistroEstudo, onCicloAtivado, onStartStudy, activeCicloId, forceOpenVisual, onGoToEdital, registrosEstudo }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  useEffect(() => {
    if (forceOpenVisual && activeCicloId) {
      setSelectedCicloId(activeCicloId);
    }
  }, [forceOpenVisual, activeCicloId]);

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
        // AQUI: Repassa os registros para a lista poder calcular o progresso
        registrosEstudo={registrosEstudo}
      />
    );
  }
}

export default CiclosPage;