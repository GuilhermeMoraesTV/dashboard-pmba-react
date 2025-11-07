import React, { useState, useEffect } from 'react';

// Ícones simples
const IconTrash = () => <span>🗑️</span>;
const IconEdit = () => <span>✏️</span>; // Para o futuro

function TopicsManagerModal({ disciplinaNome, initialTopics = [], onClose, onSave }) {

  // Estado para a lista de tópicos (começa com os tópicos existentes)
  const [topics, setTopics] = useState(
    (initialTopics || []).map(t => ({
      ...t,
      tempId: t.id || t.tempId || Date.now() // Garante um ID de key para o React
    }))
  );

  // Estado para o input de novo tópico
  const [newTopicName, setNewTopicName] = useState('');

  // Adiciona um novo tópico à lista
  const handleAddTopic = (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const newTopic = {
      id: null,
      tempId: Date.now(),
      nome: newTopicName.trim(),
    };
    setTopics([...topics, newTopic]);
    setNewTopicName('');
  };

  // Remove um tópico da lista
  const handleRemoveTopic = (topicToRemove) => {
    if (topicToRemove.id) {
      setTopics(topics.filter(t => t.id !== topicToRemove.id));
    } else {
      setTopics(topics.filter(t => t.tempId !== topicToRemove.tempId));
    }
  };

  // Salva alterações
  const handleSaveChanges = () => {
    onSave(topics);
    onClose();
  };

  return (
    // Overlay do modal
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4"
      onClick={onClose}
    >
      {/* Conteúdo do modal */}
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl w-full max-w-lg border border-border-color dark:border-dark-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
          Gerenciar Tópicos: <span className="text-primary">{disciplinaNome}</span>
        </h2>

        {/* Formulário para adicionar novo tópico */}
        <form onSubmit={handleAddTopic} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Digite o nome do novo tópico"
            className="flex-grow p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="px-5 py-3 bg-green-500 text-white rounded font-semibold hover:bg-green-600">
            + Adicionar
          </button>
        </form>

        {/* Lista de Tópicos Adicionados */}
        <h3 className="text-md font-semibold text-heading-color dark:text-dark-heading-color mb-2">Tópicos Cadastrados ({topics.length})</h3>
        <div className="max-h-60 overflow-y-auto space-y-2 mb-6 p-2 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color">
          {topics.length === 0 && (
            <p className='text-subtle-text-color dark:text-dark-subtle-text-color text-center p-4'>Nenhum tópico adicionado ainda.</p>
          )}
          {topics.map((topic, index) => (
            <div
              key={topic.tempId}
              className="flex justify-between items-center bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color p-3 rounded-md"
            >
              <span className="text-text-color dark:text-dark-text-color">
                {topic.nome}
              </span>
              <div className="flex gap-3">
                 <button disabled className="text-blue-500 opacity-50 cursor-not-allowed" title="Editar (em breve)">
                    <IconEdit />
                 </button>
                {/* Botão Excluir */}
                <button
                  onClick={() => handleRemoveTopic(topic)}
                  className="text-danger-color hover:brightness-125"
                  title="Excluir tópico"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Botões de Ação do Modal */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border-color dark:border-dark-border-color">
          <button
            type="button" // <-- CORRIGIDO AQUI (faltava o =)
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:brightness-110"
          >
            Salvar Tópicos ({topics.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopicsManagerModal;