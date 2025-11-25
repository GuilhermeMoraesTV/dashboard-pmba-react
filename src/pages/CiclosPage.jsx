import React, { useState, useEffect } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

function CiclosPage({ user, addRegistroEstudo, onCicloAtivado, onStartStudy, activeCicloId, forceOpenVisual }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  // *** EFEITO PARA AUTO-NAVEGAÇÃO ***
  // Quando forceOpenVisual é true e temos um ciclo ativo, abre automaticamente
  useEffect(() => {
    if (forceOpenVisual && activeCicloId) {
      setSelectedCicloId(activeCicloId);
    }
  }, [forceOpenVisual, activeCicloId]);

  if (selectedCicloId) {
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
        onCicloAtivado={onCicloAtivado}
      />
    );
  }
}

export default CiclosPage;