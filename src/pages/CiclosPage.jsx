import React, { useState } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

function CiclosPage({ user, addRegistroEstudo, onCicloAtivado, onStartStudy }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  if (selectedCicloId) {
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user}
        addRegistroEstudo={addRegistroEstudo} // <--- CORREÇÃO: Repassando a função
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