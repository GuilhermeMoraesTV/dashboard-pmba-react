import React, { useState } from 'react';
import { db, auth } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { X, Loader2, Save } from 'lucide-react';

function HistoricoRegistroModal({ user, registro, onClose }) {
  // Inicializar o estado com os dados do registro
  const [formData, setFormData] = useState({
    data: registro.data, // Manter o formato original (string ISO ou Timestamp)
    tipo: registro.tipo,
    duracao: registro.duracao || 0,
    questoes: registro.questoes || 0,
    acertos: registro.acertos || 0,
    revisao: registro.revisao || false,
    observacoes: registro.observacoes || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Converter números
    let finalValue = value;
    if (['duracao', 'questoes', 'acertos'].includes(name)) {
      finalValue = parseInt(value, 10) || 0;
    }
    if (type === 'checkbox') {
      finalValue = checked;
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const registroRef = doc(db, 'users', user.uid, 'registrosEstudo', registro.id);

      // Criar o objeto de atualização
      const updateData = {
        ...formData,
        // Garantir que os campos numéricos sejam números
        duracao: Number(formData.duracao),
        questoes: Number(formData.questoes),
        acertos: Number(formData.acertos),
      };

      // Remover campos indefinidos
      Object.keys(updateData).forEach(key =>
        updateData[key] === undefined && delete updateData[key]
      );

      await updateDoc(registroRef, updateData);

      setLoading(false);
      onClose(); // Fechar o modal

    } catch (err) {
      console.error("Erro ao atualizar registro:", err);
      setError('Falha ao salvar. Tente novamente.');
      setLoading(false);
    }
  };

  // Converter a data para o formato yyyy-MM-dd para o input
  const dataInputFormat = new Date(formData.data).toISOString().split('T')[0];

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="w-full max-w-lg bg-card-background-color rounded-xl shadow-lg border border-border-color p-6"
        onClick={(e) => e.stopPropagation()} // Impedir fechamento ao clicar no modal
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-heading-color">
            Editar Registro
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-subtle-text-color hover:bg-background-color"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Linha 1: Data e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="data" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Data</label>
              <input
                type="date"
                id="data"
                name="data"
                value={dataInputFormat}
                onChange={(e) => setFormData(prev => ({ ...prev, data: new Date(e.target.value).toISOString() }))}
                className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
              />
            </div>
             <div>
              <label htmlFor="tipo" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Tipo</label>
              <select
                id="tipo"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
              >
                <option value="teoria">Teoria</option>
                <option value="revisao">Revisão</option>
                <option value="questoes">Questões</option>
              </select>
            </div>
          </div>

          {/* Linha 2: Duração */}
          <div>
            <label htmlFor="duracao" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Duração (minutos)</label>
            <input
              type="number"
              id="duracao"
              name="duracao"
              value={formData.duracao}
              onChange={handleChange}
              className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
          </div>

          {/* Linha 3: Questões e Acertos (condicional) */}
          {formData.tipo === 'questoes' && (
             <div className="grid grid-cols-2 gap-4">
               <div>
                <label htmlFor="questoes" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Questões</label>
                <input
                  type="number"
                  id="questoes"
                  name="questoes"
                  value={formData.questoes}
                  onChange={handleChange}
                  className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                />
              </div>
              <div>
                <label htmlFor="acertos" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Acertos</label>
                <input
                  type="number"
                  id="acertos"
                  name="acertos"
                  value={formData.acertos}
                  onChange={handleChange}
                  className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                />
              </div>
             </div>
          )}

          {/* Linha 4: Observações */}
           <div>
            <label htmlFor="observacoes" className="block text-xs font-bold mb-2 text-gray-300 uppercase">Observações</label>
            <textarea
              id="observacoes"
              name="observacoes"
              rows="3"
              value={formData.observacoes}
              onChange={handleChange}
              className="w-full p-2.5 rounded-lg bg-[#1a1a1a] text-white border border-gray-800 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            ></textarea>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color text-gray-800 dark:text-dark-text-color rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-color text-white rounded-lg font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center"
            >
              {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HistoricoRegistroModal;