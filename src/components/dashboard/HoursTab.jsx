import React, { useState, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

// --- Reutiliza o mesmo HOOK ---
const useCicloData = (user) => {
  const [ciclos, setCiclos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Busca Ciclos Ativos
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ciclosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCiclos(ciclosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Busca Disciplinas do ciclo ativo
  useEffect(() => {
    if (!ciclos || ciclos.length === 0) {
      setDisciplinas([]);
      return;
    }
    const cicloAtivoId = ciclos[0].id;
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloAtivoId, 'disciplinas');

    const unsubscribe = onSnapshot(disciplinasRef, (snapshot) => {
      const disciplinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisciplinas(disciplinasData);
    });
    return () => unsubscribe();
  }, [ciclos, user.uid]);

  return { ciclos, disciplinas, loadingCiclos: loading };
};
// --- FIM DO HOOK ---

// Função helper para formatar H:M (Ex: 1.5 -> 01h 30m)
const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};


// --- COMPONENTE PRINCIPAL ---
function HoursTab({ registrosEstudo, onAddRegistro, onDeleteRegistro, user }) {
  // Filtra os registros para mostrar apenas horas
  const hoursData = useMemo(() =>
    registrosEstudo.filter(r => r.tipo === 'Horas'),
    [registrosEstudo]
  );

  // Estados do formulário
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState(''); // Armazena como string (ex: "1.5")

  // --- NOVOS ESTADOS DO FORMULÁRIO ---
  const [selectedCicloId, setSelectedCicloId] = useState('');
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState('');

  // Busca dados dos ciclos e disciplinas
  const { ciclos, disciplinas, loadingCiclos } = useCicloData(user);

  // Atualiza o cicloId selecionado
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
    const horasEmDecimal = parseFloat(hours);
    const duracaoEmMinutos = Math.round(horasEmDecimal * 60);

    // Constrói o NOVO objeto de registro
    const novoRegistro = {
      tipo: 'Horas',
      data: Timestamp.fromDate(new Date(date + 'T03:00:00')),
      duracaoMinutos: duracaoEmMinutos,

      // Zera campos de questão
      questoesFeitas: 0,
      questoesAcertadas: 0,

      // Links com o ciclo
      cicloId: selectedCicloId,
      disciplinaId: selectedDisciplinaId,

      // Dados denormalizados
      disciplinaNome: disciplinaSelecionada?.nome || 'Desconhecida'
    };

    onAddRegistro(novoRegistro); // Chama a nova função do Dashboard

    // Limpa o formulário
    setHours('');
    setSelectedDisciplinaId(''); // Limpa a disciplina
  };

  // Totalizador
  const totalHours = useMemo(() => {
    const totalMinutes = hoursData.reduce((acc, item) => acc + item.duracaoMinutos, 0);
    return totalMinutes / 60;
  }, [hoursData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Coluna 1: Formulário de Registro */}
      <div className="lg:col-span-1">
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">Registrar Horas</h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Dropdown de Disciplina */}
            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Disciplina</label>
              <select
                value={selectedDisciplinaId}
                onChange={(e) => setSelectedDisciplinaId(e.target.value)}
                required
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{loadingCiclos ? "Carregando..." : "Selecione a disciplina"}</option>
                {disciplinas.map(disciplina => (
                  <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Horas (ex: 1.5 para 1h 30m)</label>
              <input
                type="number"
                step="0.1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg shadow-lg hover:brightness-110 transition-all"
            >
              Adicionar Registro
            </button>
          </form>
        </div>

        {/* Painel de Estatísticas */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color mt-6">
            <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">Resumo de Horas</h3>
            <div className="space-y-2 text-text-color dark:text-dark-text-color">
                <div className="flex justify-between items-baseline">
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Total de Horas:</span>
                    <span className="font-semibold text-3xl text-primary">{formatDecimalHours(totalHours)}</span>
                </div>
            </div>
        </div>

      </div>

      {/* Coluna 2: Tabela de Registros */}
      <div className="lg:col-span-2">
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">Histórico de Horas</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border-color dark:border-dark-border-color">
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Data</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Disciplina</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Tempo</th>
                  <th className="p-3 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color dark:divide-dark-border-color">
                {hoursData.map((item) => (
                  <tr key={item.id} className="hover:bg-background-color dark:hover:bg-dark-background-color">
                    <td className="p-3 text-text-color dark:text-dark-text-color">
                      {item.data.toDate().toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3 text-text-color dark:text-dark-text-color font-medium">
                      {item.disciplinaNome}
                    </td>
                    <td className="p-3 text-primary font-semibold">
                      {formatDecimalHours(item.duracaoMinutos / 60)}
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

export default HoursTab;