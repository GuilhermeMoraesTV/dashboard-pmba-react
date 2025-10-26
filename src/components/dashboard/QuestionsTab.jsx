import React, { useState, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

// --- NOVO HOOK ---
// Hook customizado para buscar os dados dos ciclos e disciplinas
const useCicloData = (user) => {
  const [ciclos, setCiclos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Busca Ciclos
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true)); // Busca só o ciclo ativo

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ciclosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCiclos(ciclosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Busca Disciplinas do primeiro ciclo ativo encontrado
  useEffect(() => {
    if (!ciclos || ciclos.length === 0) {
      setDisciplinas([]);
      return;
    }
    const cicloAtivoId = ciclos[0].id; // Pega o primeiro ciclo ativo
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloAtivoId, 'disciplinas');

    const unsubscribe = onSnapshot(disciplinasRef, (snapshot) => {
      const disciplinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisciplinas(disciplinasData);
    });
    return () => unsubscribe();
  }, [ciclos, user.uid]); // Re-executa se os ciclos mudarem

  return { ciclos, disciplinas, loadingCiclos: loading };
};
// --- FIM DO NOVO HOOK ---


// --- COMPONENTE PRINCIPAL ---
function QuestionsTab({ registrosEstudo, onAddRegistro, onDeleteRegistro, user }) {
  // Filtra os registros para mostrar apenas questões
  const questionsData = useMemo(() =>
    registrosEstudo.filter(r => r.tipo === 'Questoes'),
    [registrosEstudo]
  );

  // Estados do formulário
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [questions, setQuestions] = useState('');
  const [correct, setCorrect] = useState('');

  // --- NOVOS ESTADOS DO FORMULÁRIO ---
  const [selectedCicloId, setSelectedCicloId] = useState('');
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState('');

  // Busca dados dos ciclos e disciplinas
  const { ciclos, disciplinas, loadingCiclos } = useCicloData(user);

  // Atualiza o cicloId selecionado (geralmente só haverá 1 ativo)
  useEffect(() => {
    if (ciclos.length > 0 && !selectedCicloId) {
      setSelectedCicloId(ciclos[0].id);
    }
  }, [ciclos, selectedCicloId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDisciplinaId) {
      alert("Por favor, selecione uma disciplina.");
      return;
    }

    const disciplinaSelecionada = disciplinas.find(d => d.id === selectedDisciplinaId);

    // Constrói o NOVO objeto de registro
    const novoRegistro = {
      tipo: 'Questoes',
      data: Timestamp.fromDate(new Date(date + 'T03:00:00')), // Converte data local para Timestamp
      questoesFeitas: parseInt(questions, 10),
      questoesAcertadas: parseInt(correct, 10),
      duracaoMinutos: 0, // Registros de questão não contam tempo (por enquanto)

      // Links com o ciclo
      cicloId: selectedCicloId,
      disciplinaId: selectedDisciplinaId,

      // Dados denormalizados (para facilitar a leitura em tabelas)
      disciplinaNome: disciplinaSelecionada?.nome || 'Desconhecida'
    };

    onAddRegistro(novoRegistro); // Chama a nova função do Dashboard

    // Limpa o formulário
    setQuestions('');
    setCorrect('');
    setSelectedDisciplinaId(''); // Limpa a disciplina
  };

  // Totalizadores (leem de 'questionsData' filtrado)
  const totalQuestions = useMemo(() => questionsData.reduce((acc, item) => acc + item.questoesFeitas, 0), [questionsData]);
  const totalCorrect = useMemo(() => questionsData.reduce((acc, item) => acc + item.questoesAcertadas, 0), [questionsData]);
  const performance = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Coluna 1: Formulário de Registro */}
      <div className="lg:col-span-1">
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">Registrar Questões</h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Dropdown de Disciplina */}
            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Disciplina</label>
              <select
                value={selectedDisciplinaId}
                onChange={(e) => setSelectedDisciplinaId(e.target.value)}
                required
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
              >
                <option value="">{loadingCiclos ? "Carregando..." : "Selecione a disciplina"}</option>
                {disciplinas.map(disciplina => (
                  <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Questões</label>
                <input
                  type="number"
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  required
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Acertos</label>
                <input
                  type="number"
                  value={correct}
                  onChange={(e) => setCorrect(e.target.value)}
                  required
                  className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-primary-color text-white font-semibold rounded-lg shadow-lg hover:brightness-110 transition-all"
            >
              Adicionar Registro
            </button>
          </form>
        </div>

        {/* Painel de Estatísticas */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color mt-6">
            <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">Resumo de Questões</h3>
            <div className="space-y-2 text-text-color dark:text-dark-text-color">
                <div className="flex justify-between">
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Total de Questões:</span>
                    <span className="font-semibold">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Total de Acertos:</span>
                    <span className="font-semibold text-success-color">{totalCorrect}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Performance Geral:</span>
                    <span className="font-semibold text-primary-color">{performance.toFixed(0)}%</span>
                </div>
            </div>
        </div>

      </div>

      {/* Coluna 2: Tabela de Registros */}
      <div className="lg:col-span-2">
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">Histórico de Questões</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border-color dark:border-dark-border-color">
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Data</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Disciplina</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Questões</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Acertos</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color dark:divide-dark-border-color">
                {questionsData.map((item) => (
                  <tr key={item.id} className="hover:bg-background-color dark:hover:bg-dark-background-color">
                    <td className="p-3 text-text-color dark:text-dark-text-color">
                      {item.data.toDate().toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3 text-text-color dark:text-dark-text-color font-medium">
                      {item.disciplinaNome}
                    </td>
                    <td className="p-3 text-text-color dark:text-dark-text-color">
                      {item.questoesFeitas}
                    </td>
                    <td className="p-3 text-success-color font-medium">
                      {item.questoesAcertadas}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => onDeleteRegistro(item.id)} // Chama a nova função
                        className="text-danger-color hover:brightness-125"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuestionsTab;