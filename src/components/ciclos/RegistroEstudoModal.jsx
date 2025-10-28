import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Helper para data local
const dateToYMDLocal = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

function RegistroEstudoModal({ onClose, addRegistroEstudo, cicloId, userId, disciplinasDoCiclo }) {
  const [tipoEstudo, setTipoEstudo] = useState('Teoria');
  const [disciplinaSelecionadaId, setDisciplinaSelecionadaId] = useState('');
  const [topicoSelecionadoId, setTopicoSelecionadoId] = useState('');
  const [dataEstudo, setDataEstudo] = useState(dateToYMDLocal(new Date()));
  const [horas, setHoras] = useState(0);
  const [minutos, setMinutos] = useState(0);
  const [questoesFeitas, setQuestoesFeitas] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [topicosDaDisciplina, setTopicosDaDisciplina] = useState([]);
  const [loadingTopicos, setLoadingTopicos] = useState(false);

  // Busca tópicos quando disciplina muda
  useEffect(() => {
    if (!disciplinaSelecionadaId || !cicloId || !userId) {
      setTopicosDaDisciplina([]);
      return;
    }

    setLoadingTopicos(true);
    const topicosRef = collection(db, 'users', userId, 'ciclos', cicloId, 'topicos');
    const q = query(topicosRef, where('disciplinaId', '==', disciplinaSelecionadaId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topicosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopicosDaDisciplina(topicosList);
      setLoadingTopicos(false);
    }, (error) => {
      console.error("Erro ao buscar tópicos:", error);
      setLoadingTopicos(false);
    });

    return () => unsubscribe();
  }, [disciplinaSelecionadaId, cicloId, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Conversões e validações
    const tempoTotalMinutos = parseInt(horas || 0) * 60 + parseInt(minutos || 0);
    const totalQuestoes = parseInt(questoesFeitas || 0);
    const totalAcertos = parseInt(acertos || 0);

    // Validações básicas
    if (!disciplinaSelecionadaId) {
      alert("Por favor, selecione uma disciplina.");
      return;
    }

    if (tipoEstudo === 'Teoria' && tempoTotalMinutos === 0) {
      alert("Por favor, insira o tempo estudado.");
      return;
    }

    if (tipoEstudo === 'Questões' && totalQuestoes === 0) {
      alert("Por favor, insira o número de questões.");
      return;
    }

    if (tipoEstudo === 'Revisão' && tempoTotalMinutos === 0 && totalQuestoes === 0) {
      alert("Para 'Revisão', insira o tempo gasto ou o número de questões.");
      return;
    }

    // Busca nome da disciplina e tópico
    const disciplina = disciplinasDoCiclo.find(d => d.id === disciplinaSelecionadaId);
    const topico = topicosDaDisciplina.find(t => t.id === topicoSelecionadoId);

    // ============================================
    // ESTRUTURA PADRONIZADA DO REGISTRO
    // ============================================
    const data = {
      // IDs de referência
      cicloId: cicloId,
      disciplinaId: disciplinaSelecionadaId,
      topicoId: topicoSelecionadoId || null,
      userId: userId,

      // Data (como STRING "YYYY-MM-DD")
      data: dataEstudo,

      // Tipo de estudo
      tipoEstudo: tipoEstudo,

      // Campos de tempo (SEMPRE em minutos)
      tempoEstudadoMinutos: tempoTotalMinutos,

      // Campos de questões (SEMPRE com estes nomes)
      questoesFeitas: totalQuestoes,
      acertos: totalAcertos,

      // Dados denormalizados para facilitar queries
      disciplinaNome: disciplina?.nome || 'Desconhecida',
      topicoNome: topico?.nome || null,

      // Timestamp para ordenação
      timestamp: Timestamp.now()
    };

    try {
      await addRegistroEstudo(data);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar registro:", error);
      alert("Erro ao salvar registro. Tente novamente.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center" onClick={onClose}>
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-8 rounded-lg shadow-xl z-50 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}>

        <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
          Registrar Estudo
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
              Data do Estudo
            </label>
            <input
              type="date"
              value={dataEstudo}
              onChange={(e) => setDataEstudo(e.target.value)}
              className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
              Tipo de Estudo
            </label>
            <select
              value={tipoEstudo}
              onChange={(e) => setTipoEstudo(e.target.value)}
              className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
              <option value="Teoria">Teoria</option>
              <option value="Questões">Questões</option>
              <option value="Revisão">Revisão</option>
            </select>
          </div>

          {/* Disciplina */}
          <div>
            <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
              Disciplina
            </label>
            <select
              value={disciplinaSelecionadaId}
              onChange={(e) => {
                setDisciplinaSelecionadaId(e.target.value);
                setTopicoSelecionadoId('');
              }}
              required
              className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
              <option value="">-- Selecione a Disciplina --</option>
              {disciplinasDoCiclo.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>

          {/* Tópico */}
          <div>
            <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
              Tópico (Opcional)
            </label>
            <select
              value={topicoSelecionadoId}
              onChange={(e) => setTopicoSelecionadoId(e.target.value)}
              disabled={loadingTopicos || topicosDaDisciplina.length === 0}
              className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color disabled:opacity-50"
            >
              <option value="">-- Selecione o Tópico (Opcional) --</option>
              {loadingTopicos ? (
                <option disabled>Carregando tópicos...</option>
              ) : (
                topicosDaDisciplina.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))
              )}
            </select>
          </div>

          {/* Tempo (Teoria ou Revisão) */}
          {(tipoEstudo === 'Teoria' || tipoEstudo === 'Revisão') && (
            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
                  Horas
                </label>
                <input
                  type="number"
                  min="0"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
                  Minutos
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
            </div>
          )}

          {/* Questões (Questões ou Revisão) */}
          {(tipoEstudo === 'Questões' || tipoEstudo === 'Revisão') && (
            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
                  Questões Feitas
                </label>
                <input
                  type="number"
                  min="0"
                  value={questoesFeitas}
                  onChange={(e) => setQuestoesFeitas(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
                  Acertos
                </label>
                <input
                  type="number"
                  min="0"
                  max={questoesFeitas || 0}
                  value={acertos}
                  onChange={(e) => setAcertos(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all"
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