import React from 'react';
import { motion } from 'framer-motion';
import WizardShell from './WizardShell';

const ModalEditarCronograma = ({
  user,
  cronograma,
  onFechar,
  onCronogramaAtualizado,
}) => {
  if (!cronograma) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[50vh] animate-fade-in"
    >
      <WizardShell
        user={user}
        mode="edit"
        cronogramaId={cronograma.id}
        initialState={cronograma}
        initialStep={1}
        onClose={onFechar}
        onCronogramaCriado={(cronogramaId) => onCronogramaAtualizado?.(cronogramaId)}
      />
    </motion.div>
  );
};

export default ModalEditarCronograma;
