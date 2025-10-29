import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import useTopicsDaDisciplina from '../../hooks/useTopicsDaDisciplina'; // Importando o hook

// --- Ícones ---
const IconClose = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

// --- Componente Principal do Modal ---
function RegistroEstudoModal({ onClose, addRegistroEstudo, cicloId, userId, disciplinasDoCiclo, initialData }) {

  const [formData, setFormData] = useState({
    disciplinaId: initialData?.disciplinaId || '',
    topicoId: initialData?.topicoId || '',
    data: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    minutos: initialData?.tempoEstudadoMinutos || 0,
    questoesFeitas: initialData?.questoesFeitas || 0,
    acertos: initialData?.acertos || 0,
    tipoEstudo: initialData?.tipoEstudo || 'Teoria',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isTimeFromTimer = useMemo(() =>
    initialData?.tempoEstudadoMinutos !== undefined && initialData.tempoEstudadoMinutos > 0,
    [initialData]
  );

  // Usando o hook externo
  const { topics, loadingTopics } = useTopicsDaDisciplina(userId, cicloId, formData.disciplinaId);

  useEffect(() => {
    if (formData.disciplinaId && !loadingTopics && topics.length === 0) {
      setFormData(prev => ({ ...prev, topicoId: '' }));
    }
  }, [formData.disciplinaId, loadingTopics, topics]);

  const tiposDeEstudo = ['Teoria', 'Questões', 'Revisão', 'Resumo', 'Simulado', 'Outro'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'disciplinaId') {
        setFormData(prev => ({ ...prev, topicoId: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // O onSubmit do form chama esta função
    setLoading(true);
    setErrorMessage('');

    if (!formData.disciplinaId || !formData.data || (formData.minutos <= 0 && formData.questoesFeitas <= 0)) {
        setErrorMessage('Preencha os campos obrigatórios: Disciplina, Data e pelo menos Tempo ou Questões.');
        setLoading(false);
        return;
    }

    const disciplinaNome = disciplinasDoCiclo.find(d => d.id === formData.disciplinaId)?.nome || 'Desconhecida';
    const topicoNome = topics.find(t => t.id === formData.topicoId)?.nome || '';

    const registro = {
      cicloId: cicloId,
      disciplinaId: formData.disciplinaId,
      disciplinaNome: disciplinaNome,
      topicoId: formData.topicoId || null,
      topicoNome: topicoNome || null,
      data: formData.data,
      timestamp: serverTimestamp(),
      tempoEstudadoMinutos: Number(formData.minutos),
      questoesFeitas: Number(formData.questoesFeitas),
      acertos: Number(formData.acertos),
      tipoEstudo: formData.tipoEstudo,
      // (Campos antigos normalizados)
      duracaoMinutos: Number(formData.minutos),
      questoesAcertadas: Number(formData.acertos),
    };

    try {
      await addRegistroEstudo(registro);
      setLoading(false);
      onClose(); // Fecha o modal após sucesso
    } catch (error) {
      console.error("Erro ao registrar estudo: ", error);
      setErrorMessage('Erro ao salvar o registro. Tente novamente.');
      setLoading(false);
    }
  };

  const selectedDisciplina = disciplinasDoCiclo.find(d => d.id === formData.disciplinaId);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-sm p-4">
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border-color dark:border-dark-border-color">
          <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color">
            Registrar Estudo
          </h2>
          <button onClick={onClose} className="text-subtle-text-color dark:text-dark-subtle-text-color hover:text-danger-color dark:hover:text-dark-danger-color transition-colors">
            <IconClose />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {errorMessage && (
            <div className="p-3 bg-danger-color/10 border border-danger-color/30 rounded-lg text-danger-color text-sm">
              {errorMessage}
            </div>
          )}

          {/* Linha 1: Disciplina e Tópico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="disciplinaId" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Disciplina *</label>
              <select
                id="disciplinaId"
                name="disciplinaId"
                value={formData.disciplinaId}
                onChange={handleChange}
                required
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition"
              >
                <option value="">Selecione...</option>
                {disciplinasDoCiclo.map(disc => (
                  <option key={disc.id} value={disc.id}>{disc.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="topicoId" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Tópico (Opcional)</label>
              <select
                id="topicoId"
                name="topicoId"
                value={formData.topicoId}
                onChange={handleChange}
                disabled={!formData.disciplinaId || loadingTopics}
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition disabled:opacity-50"
              >
                <option value="">{loadingTopics ? 'Carregando...' : (topics.length > 0 ? 'Selecione o tópico...' : (selectedDisciplina ? 'Nenhum tópico' : 'Selecione a disciplina'))}</option>
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Tipo de Estudo */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Tipo de Estudo *</label>
            <div className="flex flex-wrap gap-2">
                {tiposDeEstudo.map(tipo => (
                    <button
                        key={tipo}
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, tipoEstudo: tipo}))}
                        className={`
                          px-4 py-2 rounded-full text-sm font-semibold transition-all border
                          ${formData.tipoEstudo === tipo
                            ? 'bg-primary-color text-white border-transparent'
                            : 'bg-background-color dark:bg-dark-background-color border-border-color dark:border-dark-border-color hover:bg-border-color dark:hover:bg-dark-border-color'
                          }
                        `}
                    >
                        {tipo}
                    </button>
                ))}
            </div>
          </div>

          {/* Linha 3: Data e Tempo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="data" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Data *</label>
              <input
                type="date"
                id="data"
                name="data"
                value={formData.data}
                onChange={handleChange}
                required
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition"
              />
            </div>

            <div>
              <label htmlFor="minutos" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Tempo (minutos)</label>
              <input
                type="number"
                id="minutos"
                name="minutos"
                value={formData.minutos}
                onChange={handleChange}
                min="0"
                step="1"
                disabled={isTimeFromTimer}
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition disabled:opacity-50 disabled:bg-border-color dark:disabled:bg-dark-border-color"
              />
              {isTimeFromTimer && (
                <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mt-1">Tempo registrado pelo timer.</p>
              )}
            </div>
          </div>

          {/* Linha 4: Questões e Acertos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="questoesFeitas" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Questões Feitas</label>
              <input
                type="number"
                id="questoesFeitas"
                name="questoesFeitas"
                value={formData.questoesFeitas}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition"
              />
            </div>

            <div>
              <label htmlFor="acertos" className="block text-sm font-semibold mb-2 text-heading-color dark:text-dark-heading-color">Acertos</label>
              <input
                type="number"
                id="acertos"
                name="acertos"
                value={formData.acertos}
                onChange={handleChange}
                min="0"
                max={formData.questoesFeitas > 0 ? formData.questoesFeitas : undefined}
                className="w-full p-2.5 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color focus:ring-2 focus:ring-primary-color focus:border-primary-color transition"
              />
            </div>
          </div>

        </form>

        {/* Footer (Ações) */}
        <div className="p-5 bg-background-color dark:bg-dark-background-color/50 border-t border-border-color dark:border-dark-border-color flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-text-color dark:text-dark-text-color bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color hover:bg-border-color dark:hover:bg-dark-border-color transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="registro-form" // [CORREÇÃO 5] Embora o form já capture, boa prática
            // [CORREÇÃO 5] Removido o onClick={handleSubmit} daqui
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-color hover:bg-primary-hover transition flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Salvar Registro'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistroEstudoModal;