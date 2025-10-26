import React, { useState, useEffect } from 'react';

// Ícones simples
const IconTrash = () => <span>🗑️</span>;
const IconEdit = () => <span>✏️</span>; // Para o futuro

function TopicsManagerModal({ disciplinaNome, initialTopics = [], onClose, onSave }) {
  // Estado para a lista de tópicos (começa com os tópicos existentes)
  const [topics, setTopics] = useState(initialTopics);
  // Estado para o input de novo tópico
  const [newTopicName, setNewTopicName] = useState('');

  // Adiciona um novo tópico à lista
  const handleAddTopic = (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return; // Ignora se estiver vazio

    const newTopic = {
      // Usamos um ID temporário ou baseado no nome por enquanto
      // O Firestore gerará o ID real ao salvar
      id: Date.now(),
      nome: newTopicName.trim(),
      // Você pode adicionar 'ordem' aqui se quiser reordenar
    };
    setTopics([...topics, newTopic]);
    setNewTopicName(''); // Limpa o input
  };

  // Remove um tópico da lista
  const handleRemoveTopic = (topicId) => {
    setTopics(topics.filter(t => t.id !== topicId));
  };

  // Chama a função onSave passada pelo CicloCreateWizard
  // para atualizar a lista de tópicos da disciplina no estado PAI.
  const handleSaveChanges = () => {
    onSave(topics); // Envia a lista atualizada de tópicos
    onClose();      // Fecha o modal
  };

  return (
    // Overlay do modal
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4"> {/* z-index maior que o wizard */}
      {/* Conteúdo do modal */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl w-full max-w-lg border border-border-color dark:border-dark-border-color">
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
          Gerenciar Tópicos: <span className="text-primary-color">{disciplinaNome}</span>
        </h2>

        {/* Formulário para adicionar novo tópico */}
        <form onSubmit={handleAddTopic} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Digite o nome do novo tópico"
            className="flex-grow p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
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
            <div key={topic.id} className="flex justify-between items-center bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color p-3 rounded-md">
              <span className="text-text-color dark:text-dark-text-color">
                {/* Pode adicionar um número de ordem se quiser: {index + 1}. */} {topic.nome}
              </span>
              <div className="flex gap-3">
                {/* Botão Editar (funcionalidade futura) */}
                 <button disabled className="text-blue-500 opacity-50 cursor-not-allowed" title="Editar (em breve)">
                    <IconEdit />
                 </button>
                {/* Botão Excluir */}
                <button
                  onClick={() => handleRemoveTopic(topic.id)}
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
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="px-6 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110"
          >
            Salvar Tópicos ({topics.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopicsManagerModal;