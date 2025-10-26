import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import useTopicsDaDisciplina from '../../hooks/useTopicsDaDisciplina';

// Hook useDisciplinasDoCiclo (sem alteração)
const useDisciplinasDoCiclo = (user, cicloId) => {
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user || !cicloId) return;
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisciplinas(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, cicloId]);
  return { disciplinas, loadingDisciplinas: loading };
};

function RegistroEstudoModal({ user, cicloId, onClose, onAddRegistro }) {
  // Estados (sem alteração)
  const [tipoEstudo, setTipoEstudo] = useState('Teoria');
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');
  const [questoesFeitas, setQuestoesFeitas] = useState('');
  const [questoesAcertadas, setQuestoesAcertadas] = useState('');

  const { disciplinas, loadingDisciplinas } = useDisciplinasDoCiclo(user, cicloId);
  const { topics, loadingTopics } = useTopicsDaDisciplina(user, cicloId, selectedDisciplinaId);

  useEffect(() => {
    setSelectedTopicId('');
  }, [selectedDisciplinaId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDisciplinaId || !selectedTopicId) {
      alert("Por favor, selecione disciplina e tópico.");
      return;
    }

    const disciplinaSelecionada = disciplinas.find(d => d.id === selectedDisciplinaId);
    const topicoSelecionado = topics.find(t => t.id === selectedTopicId);

    const h = parseInt(horas) || 0;
    const m = parseInt(minutos) || 0;
    const duracaoTotalMinutos = (h * 60) + m;

    const novoRegistro = {
      tipo: tipoEstudo,
      data: Timestamp.fromDate(new Date(date + 'T03:00:00')),
      duracaoMinutos: duracaoTotalMinutos,
      questoesFeitas: parseInt(questoesFeitas) || 0,
      questoesAcertadas: parseInt(questoesAcertadas) || 0,
      cicloId: cicloId,
      disciplinaId: selectedDisciplinaId,
      disciplinaNome: disciplinaSelecionada?.nome || 'Desconhecida',
      topicId: selectedTopicId,
      topicName: topicoSelecionado?.nome || 'Desconhecido',
    };

    onAddRegistro(novoRegistro);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      {/* Container principal do Modal */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl w-full max-w-lg border border-border-color dark:border-dark-border-color">
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">Registrar Estudo</h2>

        <form onSubmit={handleSubmit} className="space-y-4"> {/* Adiciona espaço vertical entre os elementos */}

          {/* Seletor de Tipo (sem alteração) */}
          <div className="grid grid-cols-3 gap-2">
            {/* ... botões Teoria, Questões, Revisão ... */}
             <button type="button" onClick={() => setTipoEstudo('Teoria')} className={`p-3 rounded-lg font-semibold ${tipoEstudo === 'Teoria' ? 'bg-primary-color text-white' : 'bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color'}`}>
              Teoria
            </button>
            <button type="button" onClick={() => setTipoEstudo('Questoes')} className={`p-3 rounded-lg font-semibold ${tipoEstudo === 'Questoes' ? 'bg-primary-color text-white' : 'bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color'}`}>
              Questões
            </button>
            <button type="button" onClick={() => setTipoEstudo('Revisao')} className={`p-3 rounded-lg font-semibold ${tipoEstudo === 'Revisao' ? 'bg-primary-color text-white' : 'bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color'}`}>
              Revisão
            </button>
          </div>

          {/* Dropdown de Disciplina (Garante w-full no select) */}
          <div>
            <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Disciplina</label>
            <select
              value={selectedDisciplinaId}
              onChange={(e) => setSelectedDisciplinaId(e.target.value)}
              required
              className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
              <option value="">{loadingDisciplinas ? "Carregando..." : "Selecione a disciplina"}</option>
              {disciplinas.map(disciplina => (
                <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>
              ))}
            </select>
          </div>

          {/* Dropdown de Tópico (Garante w-full no select) */}
          {selectedDisciplinaId && (
            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Tópico Estudado</label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                required
                disabled={loadingTopics || topics.length === 0}
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color disabled:opacity-50"
              >
                <option value="">
                  {loadingTopics ? "Carregando tópicos..." : (topics.length === 0 ? "Nenhum tópico cadastrado" : "Selecione o tópico")}
                </option>
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Inputs Condicionais (Layout Corrigido) */}
          {tipoEstudo === 'Questoes' ? (
            <div className="flex gap-4"> {/* Mantém flex e gap */}
              <div className="flex-1"> {/* Garante que divida o espaço */}
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Questões Feitas</label>
                <input
                  type="number"
                  value={questoesFeitas}
                  onChange={(e) => setQuestoesFeitas(e.target.value)}
                  required
                  placeholder='20'
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color" // Garante w-full
                />
              </div>
              <div className="flex-1"> {/* Garante que divida o espaço */}
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Acertos</label>
                <input
                  type="number"
                  value={questoesAcertadas}
                  onChange={(e) => setQuestoesAcertadas(e.target.value)}
                  required
                  placeholder='18'
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color" // Garante w-full
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-4"> {/* Mantém flex e gap */}
              <div className="flex-1"> {/* Garante que divida o espaço */}
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Horas</label>
                <input
                  type="number"
                  min="0" // Evita números negativos
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder='1'
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color" // Garante w-full
                />
              </div>
              <div className="flex-1"> {/* Garante que divida o espaço */}
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Minutos</label>
                <input
                  type="number"
                  min="0" max="59" // Limita os minutos
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  placeholder='30'
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color" // Garante w-full
                />
              </div>
            </div>
          )}

          {/* Campo de Data (Garante w-full no input) */}
          <div>
            <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Data do Estudo</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color" // Garante w-full
            />
          </div>

          {/* Botões de Ação (Layout Corrigido) */}
          {/* Adiciona pt-4 e border-t para espaçamento e linha divisória */}
          <div className="flex justify-end gap-4 pt-4 border-t border-border-color dark:border-dark-border-color">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors" // Estilo consistente
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-color text-white rounded-lg font-semibold enabled:hover:brightness-110 disabled:opacity-50 transition-opacity" // Estilo consistente
            >
              Salvar Registro
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default RegistroEstudoModal;