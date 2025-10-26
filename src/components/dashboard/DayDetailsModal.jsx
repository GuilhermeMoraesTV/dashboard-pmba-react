import React from 'react';

// --- Funções Helper (Suas funções originais) ---
const formatDecimalHours = (d) => {
    // CORREÇÃO: Sua função recebia horas, agora recebe minutos
    if (!d || d < 0) return '00h 00m'; // Modificado para h:m
    const totalMinutes = Math.round(d); // Já está em minutos
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    // Retorna no formato HHh MMm
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const getPColorClass = (p) => {
    if (p > 88) return 'text-excellent-color'; // Supondo que você tenha essa classe
    if (p >= 80) return 'text-success-color';
    if (p >= 60) return 'text-warning-color'; // Supondo que você tenha essa classe
    return 'text-danger-color';
};
// -------------------------------------

// Ícone simples de lixeira
const IconTrash = () => <span>🗑️</span>;

// --- COMPONENTE MODIFICADO ---
// Recebe 'onDeleteRegistro'
function DayDetailsModal({ date, dayData, onClose, onDeleteRegistro }) {
  if (!date || !dayData) {
    return null;
  }

  // dayData agora contém 'dayQuestions' e 'dayHours' filtrados
  // com o NOVO formato de objeto
  const { dayQuestions, dayHours } = dayData;

  // Calcula os totais usando os NOVOS nomes de propriedade
  const totalQ = dayQuestions.reduce((s, d) => s + d.questoesFeitas, 0);
  const totalC = dayQuestions.reduce((s, d) => s + d.questoesAcertadas, 0);
  const totalM = dayHours.reduce((s, d) => s + d.duracaoMinutos, 0); // Soma minutos
  const totalH = totalM / 60; // Converte para horas decimais APENAS para o card de resumo
  const perc = totalQ > 0 ? ((totalC / totalQ) * 100) : 0;

  const formattedDate = new Date(date + 'T03:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-300 opacity-100 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color
                   rounded-xl shadow-lg p-6 md:p-8 w-11/12 max-w-3xl max-h-[90vh]
                   overflow-y-auto transform transition-transform duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho (sem alteração) */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-border-color dark:border-dark-border-color">
          <h2 className="text-xl md:text-2xl font-bold text-heading-color dark:text-dark-heading-color m-0 border-none">
            {formattedDate}
          </h2>
          <button
            className="bg-transparent border-none text-3xl cursor-pointer text-text-color dark:text-dark-text-color hover:text-danger-color"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Corpo do Modal */}
        <div>
          {/* Painel de Resumo (Usa sua função formatDecimalHours original que retorna H:M:S, mas passamos minutos) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Total de Horas</h4>
              {/* Passa totalM (minutos) para a função formatDecimalHours */}
              <p className="m-0 text-2xl font-bold text-heading-color dark:text-dark-heading-color">{formatDecimalHours(totalM)}</p>
            </div>
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Total de Questões</h4>
              <p className="m-0 text-2xl font-bold text-heading-color dark:text-dark-heading-color">{totalQ}</p>
            </div>
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Aproveitamento</h4>
              <p className={`m-0 text-2xl font-bold ${getPColorClass(perc)}`}>{perc.toFixed(1)}%</p>
            </div>
          </div>

          {/* Tabela de Questões (CORRIGIDA) */}
          <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color mb-3">Questões</h3>
          <table className="w-full border-collapse mb-6">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Disciplina</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Questões</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Acertos</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Aproveitamento</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Ações</th> {/* Nova Coluna */}
              </tr>
            </thead>
            <tbody>
              {dayQuestions.length > 0 ? (
                dayQuestions.map((q) => { // Usa o ID do registro como key
                  // Lê os NOVOS nomes das propriedades
                  const p = q.questoesFeitas > 0 ? (q.questoesAcertadas / q.questoesFeitas) * 100 : 0;
                  return (
                    <tr key={q.id} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                      <td className="p-3 align-middle text-sm">{q.disciplinaNome || 'Geral'}</td>
                      <td className="p-3 align-middle text-sm">{q.questoesFeitas}</td>
                      <td className="p-3 align-middle text-sm">{q.questoesAcertadas}</td>
                      <td className={`p-3 align-middle text-sm font-semibold ${getPColorClass(p)}`}>{p.toFixed(1)}%</td>
                      <td className="p-3 align-middle text-sm"> {/* Botão Excluir */}
                        <button
                          onClick={() => onDeleteRegistro(q.id)}
                          className="text-danger-color opacity-60 hover:opacity-100"
                          title="Excluir este registro"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan="5" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro de questão.</td></tr>
              )}
            </tbody>
          </table>

          {/* Tabela de Horas (CORRIGIDA) */}
          <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color mb-3">Horas de Estudo</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Atividade</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Tempo Dedicado</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Ações</th> {/* Nova Coluna */}
              </tr>
            </thead>
            <tbody>
              {dayHours.length > 0 ? (
                dayHours.map((h) => ( // Usa o ID do registro como key
                  <tr key={h.id} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                    {/* Lê os NOVOS nomes das propriedades */}
                    <td className="p-3 align-middle text-sm">{h.disciplinaNome || 'Geral'} <span className='text-xs text-subtle-text-color dark:text-dark-subtle-text-color'>({h.tipo})</span></td>
                    {/* Passa minutos para a função formatDecimalHours */}
                    <td className="p-3 align-middle text-sm font-semibold">{formatDecimalHours(h.duracaoMinutos)}</td>
                     <td className="p-3 align-middle text-sm"> {/* Botão Excluir */}
                        <button
                          onClick={() => onDeleteRegistro(h.id)}
                          className="text-danger-color opacity-60 hover:opacity-100"
                          title="Excluir este registro"
                        >
                          <IconTrash />
                        </button>
                      </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="3" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro de horas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DayDetailsModal;