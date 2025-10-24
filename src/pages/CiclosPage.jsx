import React, { useState } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

// Recebe 'user' como prop do Dashboard
function CiclosPage({ user }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  if (selectedCicloId) {
    // Passa 'user' para a página de Detalhe
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user} // <-- Prop 'user' adicionada
      />
    );
  } else {
    // Passa 'user' para a página de Lista
    return (
      <CiclosList
        onCicloClick={(id) => setSelectedCicloId(id)}
        user={user} // <-- Prop 'user' adicionada
      />
    );
  }
}

export default CiclosPage;