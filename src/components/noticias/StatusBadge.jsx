import React from 'react';
import { STATUS_CONCURSO, STATUS_CORES } from '../../utils/estadosSlugs';

/**
 * Badge de Status semântico para concursos
 * Verde = Edital Publicado
 * Amarelo = Autorizado / Banca Definida
 * Azul = Previsto / Comissão Formada
 * Vermelho = Suspenso
 * Cinza = Encerrado
 */
export default function StatusBadge({ status, size = 'sm', className = '' }) {
  if (!status) return null;

  const cores = STATUS_CORES[status] || STATUS_CORES[STATUS_CONCURSO.PREVISTO];
  const sizeClasses = size === 'lg' ? 'text-xs px-3 py-1' : 'text-[10px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center font-bold rounded-full border ${cores.bg} ${cores.text} ${cores.border} ${sizeClasses} ${className}`}>
      {status}
    </span>
  );
}