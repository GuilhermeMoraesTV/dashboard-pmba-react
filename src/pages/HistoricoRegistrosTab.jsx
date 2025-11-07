// src/pages/HistoricoRegistrosPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDocs, where
} from 'firebase/firestore';
import { 
  Trash2, Edit, Calendar, Clock, CheckSquare, Hash, Filter, Eye, Download
} from 'lucide-react';

function HistoricoRegistrosPage({ user }) {
  const [registros, setRegistros] = useState([]);
  const [ciclosMap, setCiclosMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // 'todos', 'ciclo_id'
  const [cicloSelecionado, setCicloSelecionado] = useState('');
  const [ciclos, setCiclos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [registroEditando, setRegistroEditando] = useState(null);

  // Buscar ciclos
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const unsubscribe = onSnapshot(ciclosRef, (snapshot) => {
      const ciclosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCiclos(ciclosData);
      
      const mapa = {};
      ciclosData.forEach(ciclo => {
        mapa[ciclo.id] = ciclo.nome;
      });
      setCiclosMap(mapa);
    });
    return () => unsubscribe();
  }, [user]);

  // Buscar registros
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
    const q = query(registrosRef, orderBy('data', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const registrosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setRegistros(registrosData);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar registros:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filtrar registros
  const registrosFiltrados = cicloSelecionado 
    ? registros.filter(r => r.cicloId === cicloSelecionado)
    : registros;

  // Deletar registro
  const handleDelete = async (registroId) => {
    if (!window.confirm('Deseja excluir este registro permanentemente?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', registroId));
      alert('Registro excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir o registro.');
    }
  };

  // Abrir modal de edição
  const handleEdit = (registro) => {
    setRegistroEditando({ ...registro });
    setModalOpen(true);
  };

  // Salvar alterações
  const handleSave = async () => {
    if (!registroEditando) return;

    try {
      const registroRef = doc(db, 'users', user.uid, 'registrosEstudo', registroEditando.id);
      await updateDoc(registroRef, {
        tempoEstudadoMinutos: Number(registroEditando.tempoEstudadoMinutos) || 0,
        questoesFeitas: Number(registroEditando.questoesFeitas) || 0,
        acertos: Number(registroEditando.acertos) || 0,
        topico: registroEditando.topico || '',
        observacoes: registroEditando.observacoes || '',
      });
      setModalOpen(false);
      setRegistroEditando(null);
      alert('Registro atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao atualizar o registro.');
    }
  };

  // Formatar horas
  const formatarHoras = (minutos) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-subtle-text-color">Carregando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
        <h1 className="text-3xl font-bold text-heading-color dark:text-dark-heading-color mb-2">
          📋 Histórico Completo de Registros
        </h1>
        <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
          Visualize, edite e exclua todos os seus registros de estudo
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter size={20} className="text-primary" />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCicloSelecionado('')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                cicloSelecionado === ''
                  ? 'bg-primary text-white'
                  : 'bg-background-color dark:bg-dark-background-color text-text-color hover:bg-border-color'
              }`}
            >
              Todos ({registros.length})
            </button>
            {ciclos.map(ciclo => (
              <button
                key={ciclo.id}
                onClick={() => setCicloSelecionado(ciclo.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  cicloSelecionado === ciclo.id
                    ? 'bg-primary text-white'
                    : 'bg-background-color dark:bg-dark-background-color text-text-color hover:bg-border-color'
                }`}
              >
                {ciclo.nome} ({registros.filter(r => r.cicloId === ciclo.id).length})
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-subtle-text-color mt-4">
          Total de registros filtrados: <span className="font-bold text-primary">{registrosFiltrados.length}</span>
        </p>
      </div>

      {/* Tabela de Registros */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color overflow-x-auto">
        {registrosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Eye size={48} className="mx-auto text-subtle-text-color mb-4 opacity-50" />
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
              Nenhum registro encontrado neste filtro.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-border-color dark:border-dark-border-color">
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">Data</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">Disciplina</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">Ciclo</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">⏱️ Tempo</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">❓ Questões</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color">✅ Acertos</th>
                <th className="pb-4 px-3 text-xs uppercase font-bold text-subtle-text-color text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((registro, idx) => (
                <tr 
                  key={registro.id}
                  className="border-b border-border-color dark:border-dark-border-color hover:bg-background-color dark:hover:bg-dark-background-color transition-colors"
                >
                  <td className="py-4 px-3">
                    {new Date(registro.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-4 px-3 font-semibold text-heading-color dark:text-dark-heading-color">
                    {registro.disciplinaNome || registro.disciplinaId || 'N/A'}
                  </td>
                  <td className="py-4 px-3 text-subtle-text-color">
                    {ciclosMap[registro.cicloId] || 'Desconhecido'}
                  </td>
                  <td className="py-4 px-3 text-primary font-semibold">
                    {formatarHoras(registro.tempoEstudadoMinutos || 0)}
                  </td>
                  <td className="py-4 px-3">
                    {registro.questoesFeitas || 0}
                  </td>
                  <td className="py-4 px-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      registro.questoesFeitas > 0
                        ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'text-subtle-text-color'
                    }`}>
                      {registro.acertos || 0}/{registro.questoesFeitas || 0}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-right flex gap-2 justify-end">
                    <button
                      onClick={() => handleEdit(registro)}
                      className="p-2 rounded-lg text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(registro.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Edição */}
      {modalOpen && registroEditando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl p-8 w-full max-w-2xl border border-border-color dark:border-dark-border-color">
            <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
              ✏️ Editar Registro
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-color mb-2">Data</label>
                <input
                  type="date"
                  value={registroEditando.data}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, data: e.target.value })}
                  className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-color mb-2">Tempo (minutos)</label>
                  <input
                    type="number"
                    value={registroEditando.tempoEstudadoMinutos}
                    onChange={(e) => setRegistroEditando({ ...registroEditando, tempoEstudadoMinutos: e.target.value })}
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-color mb-2">Questões Feitas</label>
                  <input
                    type="number"
                    value={registroEditando.questoesFeitas}
                    onChange={(e) => setRegistroEditando({ ...registroEditando, questoesFeitas: e.target.value })}
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-color mb-2">Acertos</label>
                  <input
                    type="number"
                    value={registroEditando.acertos}
                    onChange={(e) => setRegistroEditando({ ...registroEditando, acertos: e.target.value })}
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-color mb-2">Tópico</label>
                  <input
                    type="text"
                    value={registroEditando.topico || ''}
                    onChange={(e) => setRegistroEditando({ ...registroEditando, topico: e.target.value })}
                    className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-color mb-2">Observações</label>
                <textarea
                  value={registroEditando.observacoes || ''}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, observacoes: e.target.value })}
                  rows="4"
                  className="w-full p-3 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color focus:outline-none focus:ring-2 focus:ring-primary text-text-color"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all"
              >
                💾 Salvar Alterações
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setRegistroEditando(null);
                }}
                className="flex-1 px-6 py-3 bg-border-color dark:bg-dark-border-color text-text-color hover:bg-border-color dark:hover:bg-dark-border-color font-bold rounded-lg transition-all"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoricoRegistrosPage;
