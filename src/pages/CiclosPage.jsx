import React, { useState } from 'react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloDetalhePage from './CicloDetalhePage';

// Recebe 'user', 'addRegistroEstudo' e a NOVA 'onCicloAtivado'
function CiclosPage({ user, addRegistroEstudo, onCicloAtivado }) {
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
    // Passa 'user' e a NOVA 'onCicloAtivado' para a página de Lista
    return (
      <CiclosList
        onCicloClick={(id) => setSelectedCicloId(id)}
        user={user}
        onCicloAtivado={onCicloAtivado} // <-- Prop 'onCicloAtivado' passada
      />
    );
  }
}

export default CiclosPage;