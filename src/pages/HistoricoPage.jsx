import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { Loader2, Edit, Trash2, Calendar, Clock, CheckSquare, Hash } from 'lucide-react';
import HistoricoRegistroModal from '../components/historico/HistoricoRegistroModal'; // O modal que vamos criar

function HistoricoPage({ user }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para o Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [registroSelecionado, setRegistroSelecionado] = useState(null);

  // 1. Carregar todos os registros de estudo
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
    const q = query(registrosRef, orderBy('data', 'desc')); // Ordenar pelos mais recentes

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Precisamos "enriquecer" os registros com nomes de ciclos e disciplinas
      // Isso é complexo. Vamos buscar os mapas primeiro.

      const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
      const ciclosSnap = await getDocs(ciclosRef);
      const ciclosMap = new Map();
      ciclosSnap.docs.forEach(doc => ciclosMap.set(doc.id, doc.data().nome));

      const disciplinasMap = new Map();
      // Isso é muito lento se tiver muitos ciclos.
      // Para simplificar por agora, vamos usar os IDs.
      // Em uma V2, você pode salvar 'disciplinaNome' e 'cicloNome'
      // diretamente no objeto de registro.

      const registrosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Tentar buscar o nome do ciclo
        cicloNome: ciclosMap.get(doc.data().cicloId) || 'Ciclo Desconhecido'
      }));

      setRegistros(registrosData);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar registros:", err);
      setError('Não foi possível carregar o histórico.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Funções de Ação (Editar, Excluir)
  const handleEdit = (registro) => {
    setRegistroSelecionado(registro);
    setModalOpen(true);
  };

  const handleDelete = async (registroId) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro permanentemente?")) {
      return;
    }
    try {
      const registroRef = doc(db, 'users', user.uid, 'registrosEstudo', registroId);
      await deleteDoc(registroRef);
      // O onSnapshot atualizará a lista automaticamente
    } catch (err) {
      console.error("Erro ao deletar registro:", err);
      alert("Falha ao excluir o registro.");
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setRegistroSelecionado(null);
  };

  // 3. Renderização
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-color" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }

  return (
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
        Histórico Completo de Registros
      </h2>

      {registros.length === 0 ? (
        <p className="text-subtle-text-color text-center py-8">Nenhum registro encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-border-color dark:border-dark-border-color">
                <th className="p-3 text-xs uppercase text-subtle-text-color">Data</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color">Disciplina</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color">Tipo</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color">Duração</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color">Questões</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color">Ciclo</th>
                <th className="p-3 text-xs uppercase text-subtle-text-color text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color dark:divide-dark-border-color">
              {registros.map(reg => (
                <tr key={reg.id} className="hover:bg-background-color dark:hover:bg-dark-background-color">
                  <td className="p-3 text-sm text-text-color">
                    {new Date(reg.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-3 text-sm font-medium text-heading-color">
                    {reg.disciplinaNome || reg.disciplinaId}
                  </td>
                  <td className="p-3 text-sm text-text-color">{reg.tipo}</td>
                  <td className="p-3 text-sm text-text-color">{reg.duracao} min</td>
                  <td className="p-3 text-sm text-text-color">
                    {reg.tipo === 'questoes' ? `${reg.acertos} / ${reg.questoes}` : 'N/A'}
                  </td>
                  <td className="p-3 text-sm text-subtle-text-color">{reg.cicloNome}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleEdit(reg)}
                      className="p-2 rounded-lg text-subtle-text-color hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(reg.id)}
                      className="p-2 rounded-lg text-subtle-text-color hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. O Modal de Edição */}
      {modalOpen && (
        <HistoricoRegistroModal
          user={user}
          registro={registroSelecionado}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default HistoricoPage;