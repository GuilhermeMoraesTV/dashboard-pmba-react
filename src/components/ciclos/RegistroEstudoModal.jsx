import React, { useState, useMemo } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { X, Save, Clock, Target, BookOpen, List, Calendar, AlertTriangle } from 'lucide-react';

// Função utilitária para obter a data local no formato YYYY-MM-DD,
// evitando o problema de fuso horário do toISOString().
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    // getMonth() é 0-indexed.
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function RegistroEstudoModal({ onClose, addRegistroEstudo, cicloId, disciplinasDoCiclo, initialData }) {

  const minutesToHoursMinutes = (totalMinutes) => {
    if (totalMinutes === undefined || totalMinutes === null || totalMinutes <= 0) {
      return { horas: 0, minutos: 0 };
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { horas: h, minutos: m };
  };

  const initialTime = minutesToHoursMinutes(initialData?.tempoEstudadoMinutos);

  const [formData, setFormData] = useState({
    disciplinaId: initialData?.disciplinaId || '',
    // CORRIGIDO: Usa a função local para garantir que a data inicial seja a do dia local.
    data: initialData?.data || getLocalDateString(),
    horas: initialTime.horas,
    minutos: initialTime.minutos,
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

  const tiposDeEstudo = ['Teoria', 'Questões', 'Revisão', 'Resumo', 'Simulado', 'Outro'];

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const numericValue = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const totalMinutesFromForm = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);

    if (!formData.disciplinaId || !formData.data || (totalMinutesFromForm <= 0 && formData.questoesFeitas <= 0)) {
        setErrorMessage('Preencha: Disciplina, Data e pelo menos Tempo ou Questões.');
        setLoading(false);
        return;
    }

    const disciplinaNome = disciplinasDoCiclo.find(d => d.id === formData.disciplinaId)?.nome || 'Desconhecida';

    const registro = {
      cicloId,
      disciplinaId: formData.disciplinaId,
      disciplinaNome,
      // O campo 'data' (string YYYY-MM-DD) é o que define o dia de estudo.
      data: formData.data,
      timestamp: serverTimestamp(), // Mantém o timestamp UTC para o momento exato do registro.
      tempoEstudadoMinutos: totalMinutesFromForm,
      questoesFeitas: Number(formData.questoesFeitas),
      acertos: Number(formData.acertos),
      tipoEstudo: formData.tipoEstudo,
      duracaoMinutos: totalMinutesFromForm,
      questoesAcertadas: Number(formData.acertos),
    };

    try {
      await addRegistroEstudo(registro);
      setLoading(false);
      onClose();
    } catch (error) {
      console.error("Erro ao registrar:", error);
      setErrorMessage('Erro ao salvar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>

      {/* CARD PRINCIPAL */}
      <div
        className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* --- HEADER TÁTICO --- */}
        <div className="relative flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">

            {/* Marca D'água */}
            <div className="absolute -right-6 -top-6 text-red-500/10 dark:text-red-500/5 pointer-events-none transform rotate-12">
                <Save size={140} strokeWidth={1.5} />
            </div>

            <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-red-500/20">
                    <Save size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                      Registrar Estudo
                    </h2>

                </div>
            </div>

            <button
              onClick={onClose}
              className="relative z-10 p-2 text-zinc-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              <X size={24} />
            </button>
        </div>

        {/* --- FORMULÁRIO --- */}
        <form onSubmit={handleSubmit} id="registro-form" className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">

          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2 animate-pulse">
              <AlertTriangle size={18} />
              {errorMessage}
            </div>
          )}

          {/* SEÇÃO 1: DISCIPLINA E DATA (LADO A LADO) */}
          <div className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DISCIPLINA */}
                <div className="group">
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Disciplina</label>
                  <select
                    name="disciplinaId"
                    value={formData.disciplinaId}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none text-zinc-800 dark:text-white font-medium appearance-none"
                  >
                    <option value="">Selecione a matéria...</option>
                    {disciplinasDoCiclo.map(disc => (
                      <option key={disc.id} value={disc.id}>{disc.nome}</option>
                    ))}
                  </select>
                </div>

                {/* DATA */}
                <div className="group">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-2">
                         Data da Realização
                    </label>
                    <input
                        type="date"
                        name="data"
                        value={formData.data}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none text-zinc-800 dark:text-white font-bold"
                    />
                </div>
              </div>
          </div>

          {/* SEÇÃO 2: TIPO DE ESTUDO */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <List size={14} /> Tipo do Estudo
            </h3>

            <div className="flex flex-wrap gap-2">
                {tiposDeEstudo.map(tipo => (
                    <button
                        key={tipo}
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, tipoEstudo: tipo}))}
                        className={`
                          px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border
                          ${formData.tipoEstudo === tipo
                            ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }
                        `}
                    >
                        {tipo}
                    </button>
                ))}
            </div>
          </div>

          {/* SEÇÃO 3: MÉTRICAS (TEMPO E QUESTÕES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">

              {/* TEMPO */}
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock size={14} className="text-amber-500" /> Tempo de Foco
                  </h3>
                  <div className="flex gap-3 items-end">
                      <div className="flex-1">
                          <label className="text-xs font-semibold text-zinc-500 mb-1 block">Horas</label>
                          <input
                            type="number" name="horas" value={formData.horas} onChange={handleChange}
                            min="0" disabled={isTimeFromTimer}
                            className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all disabled:opacity-50"
                            placeholder="0"
                          />
                      </div>
                      <span className="text-zinc-400 font-bold pb-4">:</span>
                      <div className="flex-1">
                          <label className="text-xs font-semibold text-zinc-500 mb-1 block">Minutos</label>
                          <input
                            type="number" name="minutos" value={formData.minutos} onChange={handleChange}
                            min="0" max="59" disabled={isTimeFromTimer}
                            className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all disabled:opacity-50"
                            placeholder="0"
                          />
                      </div>
                  </div>
                  {isTimeFromTimer && <p className="text-xs text-amber-500 font-medium text-center">* Cronometrado automaticamente</p>}
              </div>

              {/* QUESTÕES */}
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Target size={14} className="text-emerald-500" /> Questões
                  </h3>
                  <div className="flex gap-3">
                      <div className="flex-1">
                          <label className="text-xs font-semibold text-zinc-500 mb-1 block">Feitas</label>
                          <input
                            type="number" name="questoesFeitas" value={formData.questoesFeitas} onChange={handleChange}
                            min="0"
                            className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-semibold text-zinc-500 mb-1 block">Acertos</label>
                          <input
                            type="number" name="acertos" value={formData.acertos} onChange={handleChange}
                            min="0" max={formData.questoesFeitas}
                            className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                      </div>
                  </div>
              </div>
          </div>

        </form>

        {/* --- FOOTER --- */}
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4 relative z-20">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="registro-form"
            disabled={loading}
            className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : <><Save size={18} /> Confirmar Registro</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistroEstudoModal;