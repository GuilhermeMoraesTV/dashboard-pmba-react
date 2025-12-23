import React, { useState, useEffect, useMemo } from 'react';
import { serverTimestamp, doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { X, Save, Clock, Target, List, AlertTriangle, ChevronDown, CheckSquare } from 'lucide-react';

const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function RegistroEstudoModal({ onClose, addRegistroEstudo, cicloId, userId, disciplinasDoCiclo, initialData }) {

  const minutesToHoursMinutes = (totalMinutes) => {
    if (totalMinutes === undefined || totalMinutes === null || totalMinutes <= 0) return { horas: 0, minutos: 0 };
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { horas: h, minutos: m };
  };

  const initialTime = minutesToHoursMinutes(initialData?.tempoEstudadoMinutos);

  const [formData, setFormData] = useState({
    disciplinaId: initialData?.disciplinaId || '',
    data: initialData?.data || getLocalDateString(),
    horas: initialTime.horas,
    minutos: initialTime.minutos,
    questoesFeitas: initialData?.questoesFeitas || 0,
    acertos: initialData?.acertos || 0,
    tipoEstudo: initialData?.tipoEstudo || 'Teoria',
  });

  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);
  const [selectedAssuntoNome, setSelectedAssuntoNome] = useState('');
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [markAsFinished, setMarkAsFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isTimeFromTimer = useMemo(() => initialData?.tempoEstudadoMinutos !== undefined && initialData.tempoEstudadoMinutos > 0, [initialData]);
  const tiposDeEstudo = ['Teoria', 'Questões', 'Revisão', 'Resumo', 'Simulado', 'Outro'];

  useEffect(() => {
    const fetchAssuntos = async () => {
        if (!formData.disciplinaId || !cicloId || !userId) {
            setAssuntosDisponiveis([]);
            return;
        }
        const disciplinaLocal = disciplinasDoCiclo.find(d => d.id === formData.disciplinaId);
        if (disciplinaLocal && Array.isArray(disciplinaLocal.assuntos)) {
            setAssuntosDisponiveis(disciplinaLocal.assuntos);
            return;
        }
        setLoadingAssuntos(true);
        try {
            const disciplinaRef = doc(db, 'users', userId, 'ciclos', cicloId, 'disciplinas', formData.disciplinaId);
            const disciplinaDoc = await getDoc(disciplinaRef);
            if (disciplinaDoc.exists()) {
                const data = disciplinaDoc.data();
                if (data.assuntos && Array.isArray(data.assuntos)) setAssuntosDisponiveis(data.assuntos);
                else setAssuntosDisponiveis([]);
            }
        } catch (error) { console.error("Erro:", error); setAssuntosDisponiveis([]); }
        finally { setLoadingAssuntos(false); }
    };
    fetchAssuntos();
    setSelectedAssuntoNome('');
    setMarkAsFinished(false);
  }, [formData.disciplinaId, cicloId, userId, disciplinasDoCiclo]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const totalMinutesFromForm = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);

    if (!formData.disciplinaId || !formData.data || (totalMinutesFromForm <= 0 && formData.questoesFeitas <= 0)) {
        setErrorMessage('Preencha disciplina, data e tempo ou questões.');
        setLoading(false);
        return;
    }

    // VALIDAÇÃO DE ASSUNTO OBRIGATÓRIO
    if (!selectedAssuntoNome) {
        setErrorMessage('Selecione um assunto/tópico para salvar.');
        setLoading(false);
        return;
    }

    const disciplinaNome = disciplinasDoCiclo.find(d => d.id === formData.disciplinaId)?.nome || 'Desconhecida';

    try {
      const registro = {
        cicloId,
        disciplinaId: formData.disciplinaId,
        disciplinaNome,
        assunto: selectedAssuntoNome,
        data: formData.data,
        timestamp: serverTimestamp(),
        tempoEstudadoMinutos: totalMinutesFromForm,
        questoesFeitas: Number(formData.questoesFeitas),
        acertos: Number(formData.acertos),
        tipoEstudo: formData.tipoEstudo,
        duracaoMinutos: totalMinutesFromForm,
        questoesAcertadas: Number(formData.acertos),
      };

      await addRegistroEstudo(registro);

      if (markAsFinished) {
          const checkData = {
              cicloId,
              disciplinaId: formData.disciplinaId,
              disciplinaNome,
              assunto: selectedAssuntoNome,
              data: formData.data,
              timestamp: serverTimestamp(),
              tempoEstudadoMinutos: 0,
              questoesFeitas: 0,
              acertos: 0,
              tipoEstudo: 'check_manual',
              obs: 'Concluído via Registro Manual'
          };
          await addDoc(collection(db, 'users', userId, 'registrosEstudo'), checkData);
      }

      setLoading(false);
      onClose();
    } catch (error) {
      console.error("Erro:", error);
      setErrorMessage('Erro ao salvar.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-red-500/20"><Save size={24} /></div>
                <div><h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Registrar Estudo</h2></div>
            </div>
            <button onClick={onClose} className="relative z-10 p-2 text-zinc-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} id="registro-form" className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2 animate-pulse"><AlertTriangle size={18} /> {errorMessage}</div>
          )}

          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Disciplina</label>
                  <div className="relative">
                      <select name="disciplinaId" value={formData.disciplinaId} onChange={handleChange} required className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none text-zinc-800 dark:text-white font-medium appearance-none">
                        <option value="">Selecione...</option>
                        {disciplinasDoCiclo.map(disc => (<option key={disc.id} value={disc.id}>{disc.nome}</option>))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3.5 text-zinc-400 pointer-events-none" size={18} />
                  </div>
                </div>
                <div className="group">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Data</label>
                    <input type="date" name="data" value={formData.data} onChange={handleChange} required className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none text-zinc-800 dark:text-white font-bold" />
                </div>
              </div>

              {formData.disciplinaId && (
                  <div className="animate-fade-in group">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex justify-between">
                        Assunto {loadingAssuntos && <span className="text-red-500 text-[10px]">Carregando...</span>}
                    </label>
                    <div className="relative">
                      <select value={selectedAssuntoNome} onChange={(e) => setSelectedAssuntoNome(e.target.value)} className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none text-zinc-800 dark:text-white font-medium appearance-none" disabled={loadingAssuntos || assuntosDisponiveis.length === 0}>
                        <option value="">Selecione o assunto...</option>
                        {assuntosDisponiveis.map((assunto, idx) => (<option key={idx} value={assunto}>{assunto}</option>))}
                      </select>
                      <Target className="absolute right-3 top-3.5 text-zinc-400 pointer-events-none" size={18} />
                    </div>

                    {selectedAssuntoNome && (
                        <div onClick={() => setMarkAsFinished(!markAsFinished)} className={`mt-4 p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${markAsFinished ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300'}`}>
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${markAsFinished ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}><CheckSquare size={14} strokeWidth={4} /></div>
                            <div><p className={`text-sm font-bold ${markAsFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>Teoria Finalizada</p><p className="text-xs text-zinc-500">Marcar este tópico como concluído.</p></div>
                        </div>
                    )}
                  </div>
              )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2"><List size={14} /> Tipo</h3>
            <div className="flex flex-wrap gap-2">
                {tiposDeEstudo.map(tipo => (
                    <button key={tipo} type="button" onClick={() => setFormData(prev => ({...prev, tipoEstudo: tipo}))} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${formData.tipoEstudo === tipo ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>{tipo}</button>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14} className="text-amber-500" /> Tempo</h3>
                  <div className="flex gap-3 items-end">
                      <div className="flex-1"><label className="text-xs font-semibold text-zinc-500 mb-1 block">Horas</label><input type="number" name="horas" value={formData.horas} onChange={handleChange} min="0" disabled={isTimeFromTimer} className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all disabled:opacity-50" placeholder="0" /></div>
                      <span className="text-zinc-400 font-bold pb-4">:</span>
                      <div className="flex-1"><label className="text-xs font-semibold text-zinc-500 mb-1 block">Minutos</label><input type="number" name="minutos" value={formData.minutos} onChange={handleChange} min="0" max="59" disabled={isTimeFromTimer} className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all disabled:opacity-50" placeholder="0" /></div>
                  </div>
              </div>
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Target size={14} className="text-emerald-500" /> Questões</h3>
                  <div className="flex gap-3">
                      <div className="flex-1"><label className="text-xs font-semibold text-zinc-500 mb-1 block">Feitas</label><input type="number" name="questoesFeitas" value={formData.questoesFeitas} onChange={handleChange} min="0" className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" /></div>
                      <div className="flex-1"><label className="text-xs font-semibold text-zinc-500 mb-1 block">Acertos</label><input type="number" name="acertos" value={formData.acertos} onChange={handleChange} min="0" max={formData.questoesFeitas} className="w-full p-3 text-center text-xl font-black border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" /></div>
                  </div>
              </div>
          </div>
        </form>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4 relative z-20">
          <button type="button" onClick={onClose} disabled={loading} className="px-6 py-3 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">Cancelar</button>
          <button type="submit" form="registro-form" disabled={loading} className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">{loading ? 'Salvando...' : <><Save size={18} /> Confirmar</>}</button>
        </div>
      </div>
    </div>
  );
}

export default RegistroEstudoModal;