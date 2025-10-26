import React, { useState } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

// Recebe 'user' e 'addRegistroEstudo' como props do Dashboard
function CiclosPage({ user, addRegistroEstudo }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  if (selectedCicloId) {
    // Passa 'user' e 'addRegistroEstudo' para a página de Detalhe
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user}
        addRegistroEstudo={addRegistroEstudo} // <-- Prop 'add' passada
      />
    );
  } else {
    // Passa 'user' para a página de Lista
    return (
      <CiclosList
        onCicloClick={(id) => setSelectedCicloId(id)}
        user={user}
      />
    );
  }
}

export default CiclosPage;