import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  formatDateKeyLocal,
  getAgendaSemana,
  getCronogramaReviewBuckets,
  getWeekOffsetFromDate,
} from '../services/scheduling/review.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const sortByDateDesc = (items, getter) => (
  [...items].sort((a, b) => {
    const aDate = getter(a)?.getTime?.() || 0;
    const bDate = getter(b)?.getTime?.() || 0;
    return bDate - aDate;
  })
);

const getRecordDate = (record) => (
  toDateSafe(record?.timestamp)
  || toDateSafe(record?.createdAt)
  || toDateSafe(record?.updatedAt)
  || toDateSafe(record?.data)
  || null
);

const getSimuladoDate = (simulado) => (
  toDateSafe(simulado?.data)
  || toDateSafe(simulado?.timestamp)
  || toDateSafe(simulado?.updatedAt)
  || null
);

const getMinutes = (record) => Number(record?.tempoEstudadoMinutos || record?.duracaoMinutos || 0);
const getQuestions = (record) => Number(record?.questoesFeitas || 0);
const getCorrect = (record) => Number(record?.acertos || 0);

const getTopicName = (topic) => {
  if (!topic) return '';
  if (typeof topic === 'string') return topic.trim();
  return String(topic.nome || topic.texto || topic.label || '').trim();
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const buildPeriodStat = (records, days, nowMs) => {
  const minDate = nowMs - (days * DAY_MS);
  const filtered = records.filter((record) => {
    const date = getRecordDate(record);
    return date && date.getTime() >= minDate;
  });
  const minutes = filtered.reduce((acc, record) => acc + getMinutes(record), 0);
  const questions = filtered.reduce((acc, record) => acc + getQuestions(record), 0);
  const correct = filtered.reduce((acc, record) => acc + getCorrect(record), 0);
  return {
    id: `${days}d`,
    label: `${days}d`,
    minutes,
    hours: Number((minutes / 60).toFixed(1)),
    questions,
    correct,
    accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
    sessions: filtered.length,
  };
};

const buildTrendData = (records, days = 14) => {
  const map = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = formatDateKeyLocal(date);
    map.set(key, {
      key,
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      minutes: 0,
      questions: 0,
      correct: 0,
    });
  }

  records.forEach((record) => {
    const recordDate = getRecordDate(record);
    if (!recordDate) return;
    const key = formatDateKeyLocal(recordDate);
    if (!map.has(key)) return;
    const bucket = map.get(key);
    bucket.minutes += getMinutes(record);
    bucket.questions += getQuestions(record);
    bucket.correct += getCorrect(record);
  });

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    hours: Number((entry.minutes / 60).toFixed(1)),
    accuracy: entry.questions > 0 ? Math.round((entry.correct / entry.questions) * 100) : null,
  }));
};

const buildDisciplineProgress = (records, metadata = []) => {
  const map = new Map();

  metadata.forEach((disciplina, index) => {
    const assuntos = Array.isArray(disciplina?.assuntos) ? disciplina.assuntos : [];
    const uniqueTopics = new Set(assuntos.map(getTopicName).filter(Boolean));
    const id = disciplina?.id || disciplina?.disciplinaId || disciplina?.nome || `disc_${index}`;
    const name = disciplina?.nome || disciplina?.disciplinaNome || 'Disciplina';
    map.set(id, {
      id,
      name,
      minutes: 0,
      questions: 0,
      correct: 0,
      sessions: 0,
      totalTopics: uniqueTopics.size,
      studiedTopics: new Set(),
    });
  });

  records.forEach((record) => {
    const id = record?.disciplinaId || record?.disciplinaNome || record?.disciplina || 'geral';
    const name = record?.disciplinaNome || record?.disciplina || 'Geral';
    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        minutes: 0,
        questions: 0,
        correct: 0,
        sessions: 0,
        totalTopics: 0,
        studiedTopics: new Set(),
      });
    }

    const entry = map.get(id);
    entry.minutes += getMinutes(record);
    entry.questions += getQuestions(record);
    entry.correct += getCorrect(record);
    entry.sessions += 1;
    if (record?.assunto) entry.studiedTopics.add(String(record.assunto).trim());
  });

  return Array.from(map.values())
    .map((entry) => {
      const studiedCount = entry.studiedTopics.size;
      const coverage = entry.totalTopics > 0
        ? Math.min(100, Math.round((studiedCount / entry.totalTopics) * 100))
        : null;

      return {
        id: entry.id,
        name: entry.name,
        minutes: entry.minutes,
        hours: Number((entry.minutes / 60).toFixed(1)),
        questions: entry.questions,
        correct: entry.correct,
        accuracy: entry.questions > 0 ? Math.round((entry.correct / entry.questions) * 100) : 0,
        sessions: entry.sessions,
        studiedTopics: studiedCount,
        totalTopics: entry.totalTopics,
        coverage,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
};

const buildDisciplineInsights = (records = [], metadata = []) => {
  const map = new Map();

  metadata.forEach((disciplina, index) => {
    const id = disciplina?.id || disciplina?.disciplinaId || disciplina?.nome || `disc_${index}`;
    const name = disciplina?.nome || disciplina?.disciplinaNome || 'Disciplina';
    map.set(id, {
      id,
      name,
      minutes: 0,
      questions: 0,
      correct: 0,
      sessions: 0,
      activeDays: new Set(),
      lastStudyDate: null,
      lastSubject: '',
    });
  });

  records.forEach((record, index) => {
    const id = record?.disciplinaId || record?.disciplinaNome || record?.disciplina || `disciplina_${index}`;
    const name = record?.disciplinaNome || record?.disciplina || 'Disciplina';
    const date = getRecordDate(record);

    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        minutes: 0,
        questions: 0,
        correct: 0,
        sessions: 0,
        activeDays: new Set(),
        lastStudyDate: null,
        lastSubject: '',
      });
    }

    const entry = map.get(id);
    entry.minutes += getMinutes(record);
    entry.questions += getQuestions(record);
    entry.correct += getCorrect(record);
    entry.sessions += 1;
    if (date) {
      entry.activeDays.add(formatDateKeyLocal(date));
      if (!entry.lastStudyDate || date > entry.lastStudyDate) {
        entry.lastStudyDate = date;
        entry.lastSubject = record?.assunto || record?.topicoNome || '';
      }
    }
  });

  return Array.from(map.values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      minutes: entry.minutes,
      hours: Number((entry.minutes / 60).toFixed(1)),
      sessions: entry.sessions,
      questions: entry.questions,
      correct: entry.correct,
      accuracy: entry.questions > 0 ? Math.round((entry.correct / entry.questions) * 100) : 0,
      activeDays: entry.activeDays.size,
      frequencyPerWeek: entry.activeDays.size > 0 ? Number(((entry.sessions / entry.activeDays.size) * 7).toFixed(1)) : 0,
      lastStudyDate: entry.lastStudyDate,
      lastSubject: entry.lastSubject,
    }))
    .sort((a, b) => {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      return b.sessions - a.sessions;
    });
};

const getCronogramaLabel = (cronograma) => (
  cronograma?.editalNome
  || cronograma?.nomeEdital
  || cronograma?.edital
  || cronograma?.templateName
  || cronograma?.concursoNome
  || cronograma?.nomeConcurso
  || cronograma?.cargo
  || null
);

const buildCronogramaPlanMetrics = (cronograma, weekOffsetAtual, nowDate = new Date(), horariosDiarios = null) => {
  if (!cronograma?.semanaTemplate?.length || !cronograma?.dataInicio) {
    return {
      totalSlots: 0,
      completedSlots: 0,
      pendingSlots: 0,
      overdueSlots: 0,
      todaySlots: 0,
      futureSlots: 0,
      totalMinutes: 0,
      completedMinutes: 0,
      progress: 0,
      weekAgenda: [],
      upcomingSlots: [],
    };
  }

  const totalSemanas = Math.max(Number(cronograma?.totalSemanasNecessarias || 0), weekOffsetAtual + 1, 1);
  const agendaCompleta = [];

  for (let week = 0; week < totalSemanas; week += 1) {
    const agendaSemana = getAgendaSemana(cronograma, week, null, null, horariosDiarios);
    if (agendaSemana?.length) agendaCompleta.push(...agendaSemana);
  }

  const teoria = agendaCompleta.filter((slot) => !slot.isRevisaoAuto);
  const hojeKey = formatDateKeyLocal(nowDate);
  const completedSlots = teoria.filter((slot) => slot.concluido === true);
  const pendingSlots = teoria.filter((slot) => slot.concluido !== true);
  const overdueSlots = pendingSlots.filter((slot) => normalizeText(slot.dataSlot) < hojeKey);
  const todaySlots = pendingSlots.filter((slot) => normalizeText(slot.dataSlot) === hojeKey);
  const futureSlots = pendingSlots.filter((slot) => normalizeText(slot.dataSlot) > hojeKey);
  const totalMinutes = teoria.reduce((acc, slot) => acc + Number(slot.tempoMinutos || slot.minutosEstudo || 0), 0);
  const completedMinutes = teoria.reduce((acc, slot) => (
    acc + Number(slot.progressoMinutos || (slot.concluido ? (slot.tempoMinutos || slot.minutosEstudo || 0) : 0))
  ), 0);
  const weekAgenda = getAgendaSemana(cronograma, weekOffsetAtual, null, null, horariosDiarios) || [];

  return {
    totalSlots: teoria.length,
    completedSlots: completedSlots.length,
    pendingSlots: pendingSlots.length,
    overdueSlots: overdueSlots.length,
    todaySlots: todaySlots.length,
    futureSlots: futureSlots.length,
    totalMinutes,
    completedMinutes,
    progress: teoria.length > 0 ? Math.round((completedSlots.length / teoria.length) * 100) : 0,
    weekAgenda,
    upcomingSlots: pendingSlots
      .sort((a, b) => String(a.dataSlot || '').localeCompare(String(b.dataSlot || '')))
      .slice(0, 12),
  };
};

const buildRiskSignals = ({
  records,
  simulados,
  activeCycle,
  activeCronograma,
  pendingCycleReviews,
  cronogramaBuckets,
}) => {
  const nowMs = Date.now();
  const lastRecord = records[0] || null;
  const lastStudyDate = lastRecord ? getRecordDate(lastRecord) : null;
  const daysInactive = lastStudyDate ? Math.floor((nowMs - lastStudyDate.getTime()) / DAY_MS) : null;
  const current30d = buildPeriodStat(records, 30, nowMs);
  const previous30dRecords = records.filter((record) => {
    const date = getRecordDate(record);
    if (!date) return false;
    const diff = nowMs - date.getTime();
    return diff > 30 * DAY_MS && diff <= 60 * DAY_MS;
  });
  const previous30dQuestions = previous30dRecords.reduce((acc, record) => acc + getQuestions(record), 0);
  const previous30dCorrect = previous30dRecords.reduce((acc, record) => acc + getCorrect(record), 0);
  const previous30dAccuracy = previous30dQuestions > 0
    ? Math.round((previous30dCorrect / previous30dQuestions) * 100)
    : null;

  const signals = [];

  if (!lastStudyDate) {
    signals.push({ level: 'critico', title: 'Aluno sem ativacao real', body: 'Ainda nao ha nenhum registro de estudo salvo para este aluno.' });
  } else if (daysInactive >= 14) {
    signals.push({ level: 'critico', title: 'Inatividade prolongada', body: `${daysInactive} dias sem registrar estudo.` });
  } else if (daysInactive >= 7) {
    signals.push({ level: 'alto', title: 'Risco de churn', body: `${daysInactive} dias sem atividade recente.` });
  }

  if (!activeCycle && !activeCronograma) {
    signals.push({ level: 'alto', title: 'Sem plano ativo', body: 'O aluno esta sem ciclo e sem cronograma ativos neste momento.' });
  }

  const totalPendingReviews = pendingCycleReviews.length
    + (cronogramaBuckets?.hoje?.length || 0)
    + (cronogramaBuckets?.atrasadas?.length || 0);
  if (totalPendingReviews >= 6) {
    signals.push({ level: 'alto', title: 'Fila de revisoes acumulada', body: `${totalPendingReviews} revisoes exigem atencao imediata.` });
  } else if (totalPendingReviews > 0) {
    signals.push({ level: 'medio', title: 'Revisoes pendentes', body: `${totalPendingReviews} revisoes aguardando execucao.` });
  }

  if (current30d.minutes > 0 && current30d.minutes < 180) {
    signals.push({ level: 'medio', title: 'Carga baixa em 30 dias', body: `Somente ${Math.round(current30d.minutes / 60)}h estudadas na janela recente.` });
  }

  if (previous30dAccuracy != null && current30d.questions > 0 && current30d.accuracy <= previous30dAccuracy - 10) {
    signals.push({ level: 'medio', title: 'Queda de precisao', body: `A precisao caiu de ${previous30dAccuracy}% para ${current30d.accuracy}% nos ultimos 30 dias.` });
  }

  const recentSimulados = simulados.filter((simulado) => {
    const date = getSimuladoDate(simulado);
    return date && (nowMs - date.getTime()) <= (30 * DAY_MS);
  });
  if (simulados.length > 0 && recentSimulados.length === 0) {
    signals.push({ level: 'baixo', title: 'Sem simulado recente', body: 'Nao ha simulados registrados nos ultimos 30 dias.' });
  }

  const severity = signals.reduce((acc, signal) => {
    if (signal.level === 'critico') return acc + 4;
    if (signal.level === 'alto') return acc + 3;
    if (signal.level === 'medio') return acc + 2;
    return acc + 1;
  }, 0);

  return {
    severity,
    status: severity >= 8 ? 'Critico' : severity >= 5 ? 'Atencao' : severity > 0 ? 'Monitorar' : 'Saudavel',
    daysInactive,
    lastStudyDate,
    signals,
  };
};

export const useAdminUser360 = ({ isOpen, user }) => {
  const uid = user?.uid || user?.id || null;
  const [records, setRecords] = useState([]);
  const [simulados, setSimulados] = useState([]);
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [cycleDisciplines, setCycleDisciplines] = useState([]);
  const [activeCronograma, setActiveCronograma] = useState(null);
  const [cycleReviews, setCycleReviews] = useState([]);
  const [ready, setReady] = useState({
    records: false,
    simulados: false,
    goals: false,
    cycle: false,
    cronograma: false,
    reviews: false,
    disciplines: false,
  });

  useEffect(() => {
    if (!isOpen || !uid) {
      setRecords([]);
      setSimulados([]);
      setGoalsHistory([]);
      setActiveCycle(null);
      setCycleDisciplines([]);
      setActiveCronograma(null);
      setCycleReviews([]);
      setReady({
        records: false,
        simulados: false,
        goals: false,
        cycle: false,
        cronograma: false,
        reviews: false,
        disciplines: false,
      });
      return undefined;
    }

    setReady({
      records: false,
      simulados: false,
      goals: false,
      cycle: false,
      cronograma: false,
      reviews: false,
      disciplines: false,
    });

    const unsubscribers = [
      onSnapshot(collection(db, 'users', uid, 'registrosEstudo'), (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            timestamp: getRecordDate(data) || new Date(0),
          };
        });
        setRecords(sortByDateDesc(next, getRecordDate));
        setReady((prev) => ({ ...prev, records: true }));
      }, () => setReady((prev) => ({ ...prev, records: true }))),

      onSnapshot(collection(db, 'users', uid, 'simulados'), (snapshot) => {
        const next = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setSimulados(sortByDateDesc(next, getSimuladoDate));
        setReady((prev) => ({ ...prev, simulados: true }));
      }, () => setReady((prev) => ({ ...prev, simulados: true }))),

      onSnapshot(collection(db, 'users', uid, 'metas'), (snapshot) => {
        const next = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        next.sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
        setGoalsHistory(next);
        setReady((prev) => ({ ...prev, goals: true }));
      }, () => setReady((prev) => ({ ...prev, goals: true }))),

      onSnapshot(
        query(collection(db, 'users', uid, 'ciclos'), where('ativo', '==', true), limit(1)),
        (snapshot) => {
          if (snapshot.empty) {
            setActiveCycle(null);
            setReady((prev) => ({ ...prev, cycle: true, disciplines: true }));
            return;
          }

          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          setActiveCycle({
            id: docSnap.id,
            ...data,
            createdAt: toDateSafe(data.dataCriacao) || toDateSafe(data.criadoEm) || null,
          });
          setReady((prev) => ({ ...prev, cycle: true }));
        },
        () => setReady((prev) => ({ ...prev, cycle: true, disciplines: true }))
      ),

      onSnapshot(
        query(collection(db, 'users', uid, 'cronogramas'), where('ativo', '==', true), limit(1)),
        (snapshot) => {
          if (snapshot.empty) {
            setActiveCronograma(null);
            setReady((prev) => ({ ...prev, cronograma: true }));
            return;
          }

          const docSnap = snapshot.docs[0];
          setActiveCronograma({ id: docSnap.id, ...docSnap.data() });
          setReady((prev) => ({ ...prev, cronograma: true }));
        },
        () => setReady((prev) => ({ ...prev, cronograma: true }))
      ),

      onSnapshot(
        query(collection(db, 'users', uid, 'revisoesCiclo'), where('concluida', '==', false)),
        (snapshot) => {
          const next = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
          next.sort((a, b) => String(a.dataAgendada || '').localeCompare(String(b.dataAgendada || '')));
          setCycleReviews(next);
          setReady((prev) => ({ ...prev, reviews: true }));
        },
        () => setReady((prev) => ({ ...prev, reviews: true }))
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [isOpen, uid]);

  useEffect(() => {
    if (!isOpen || !uid || !activeCycle?.id) {
      setCycleDisciplines([]);
      setReady((prev) => ({ ...prev, disciplines: true }));
      return undefined;
    }

    setReady((prev) => ({ ...prev, disciplines: false }));
    return onSnapshot(collection(db, 'users', uid, 'ciclos', activeCycle.id, 'disciplinas'), (snapshot) => {
      const next = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      next.sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
      setCycleDisciplines(next);
      setReady((prev) => ({ ...prev, disciplines: true }));
    }, () => setReady((prev) => ({ ...prev, disciplines: true })));
  }, [activeCycle?.id, isOpen, uid]);

  const analytics = useMemo(() => {
    const nowMs = Date.now();
    const allTimeMinutes = records.reduce((acc, record) => acc + getMinutes(record), 0);
    const allTimeQuestions = records.reduce((acc, record) => acc + getQuestions(record), 0);
    const allTimeCorrect = records.reduce((acc, record) => acc + getCorrect(record), 0);
    const currentCycleId = activeCycle?.id || null;
    const currentCronogramaId = activeCronograma?.id || null;
    const cycleRecords = currentCycleId ? records.filter((record) => record.cicloId === currentCycleId) : [];
    const cronogramaRecords = currentCronogramaId ? records.filter((record) => record.cronogramaId === currentCronogramaId) : [];
    const pendingCycleReviews = currentCycleId
      ? cycleReviews.filter((review) => review.cicloId === currentCycleId)
      : cycleReviews;
    const cronogramaBuckets = activeCronograma
      ? getCronogramaReviewBuckets(
          activeCronograma,
          new Date(),
          activeCronograma?.horariosDiarios && Object.keys(activeCronograma.horariosDiarios).length > 0
            ? activeCronograma.horariosDiarios
            : null
        )
      : { hoje: [], atrasadas: [], proximas: [], weekOffsetAtual: 0 };
    const weekOffsetAtual = activeCronograma?.dataInicio
      ? getWeekOffsetFromDate(activeCronograma.dataInicio, new Date())
      : 0;

    const periodStats = [
      buildPeriodStat(records, 7, nowMs),
      buildPeriodStat(records, 30, nowMs),
      buildPeriodStat(records, 90, nowMs),
    ];

    const simuladoTrend = [...simulados]
      .sort((a, b) => (getSimuladoDate(a)?.getTime?.() || 0) - (getSimuladoDate(b)?.getTime?.() || 0))
      .map((simulado, index) => ({
        id: simulado.id || `sim_${index}`,
        label: getSimuladoDate(simulado)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) || `S${index + 1}`,
        score: Number(simulado?.resumo?.pontosObtidos || 0),
        accuracy: Number(simulado?.resumo?.porcentagem || 0),
        title: simulado?.titulo || 'Simulado',
      }));

    const averageSimuladoScore = simuladoTrend.length
      ? simuladoTrend.reduce((acc, entry) => acc + entry.score, 0) / simuladoTrend.length
      : 0;

    const risk = buildRiskSignals({
      records,
      simulados,
      activeCycle,
      activeCronograma,
      pendingCycleReviews,
      cronogramaBuckets,
    });

    const timeline = [
      ...records.map((record) => ({
        id: `study_${record.id}`,
        type: 'study',
        date: getRecordDate(record),
        dateKey: formatDateKeyLocal(getRecordDate(record) || new Date()),
        title: record.disciplinaNome || record.disciplina || 'Estudo',
        subtitle: record.assunto || 'Sem assunto definido',
        minutes: getMinutes(record),
        questions: getQuestions(record),
        correct: getCorrect(record),
        accuracy: getQuestions(record) > 0 ? Math.round((getCorrect(record) / getQuestions(record)) * 100) : 0,
        disciplinaId: record?.disciplinaId || null,
        disciplinaNome: record?.disciplinaNome || record?.disciplina || 'Disciplina',
        contexto: record.cronogramaId ? 'Cronograma' : record.cicloId ? 'Ciclo' : 'Livre',
      })),
      ...simulados.map((simulado) => ({
        id: `sim_${simulado.id}`,
        type: 'simulado',
        date: getSimuladoDate(simulado),
        dateKey: formatDateKeyLocal(getSimuladoDate(simulado) || new Date()),
        title: simulado.titulo || 'Simulado',
        subtitle: simulado.banca || 'Registro de simulado',
        score: Number(simulado?.resumo?.pontosObtidos || 0),
        accuracy: Number(simulado?.resumo?.porcentagem || 0),
        disciplinaId: null,
        disciplinaNome: 'Simulado',
      })),
    ]
      .filter((entry) => entry.date)
      .sort((a, b) => b.date - a.date);

    const cronogramaPlan = currentCronogramaId
      ? buildCronogramaPlanMetrics(
          activeCronograma,
          weekOffsetAtual,
          new Date(),
          activeCronograma?.horariosDiarios && Object.keys(activeCronograma.horariosDiarios).length > 0
            ? activeCronograma.horariosDiarios
            : null
        )
      : null;

    const overallDisciplineInsights = buildDisciplineInsights(records, []);
    const cronogramaDisciplineInsights = buildDisciplineInsights(cronogramaRecords, activeCronograma?.disciplinasSnapshot || []);
    const historyFilters = {
      contexts: ['Todos', ...Array.from(new Set(timeline.map((entry) => entry.type === 'simulado' ? 'Simulado' : entry.contexto)))],
      types: ['Todos', ...Array.from(new Set(timeline.map((entry) => entry.type === 'simulado' ? 'Simulado' : 'Estudo')))],
      disciplines: ['Todas', ...Array.from(new Set(
        timeline
          .filter((entry) => entry.type === 'study')
          .map((entry) => entry.disciplinaNome)
          .filter(Boolean)
      ))],
    };

    return {
      allTime: {
        minutes: allTimeMinutes,
        hours: Number((allTimeMinutes / 60).toFixed(1)),
        questions: allTimeQuestions,
        correct: allTimeCorrect,
        accuracy: allTimeQuestions > 0 ? Math.round((allTimeCorrect / allTimeQuestions) * 100) : 0,
      },
      periodStats,
      trendData: buildTrendData(records, 14),
      cycleRecords,
      cronogramaRecords,
      cycleProgress: buildDisciplineProgress(cycleRecords, cycleDisciplines),
      cronogramaProgress: buildDisciplineProgress(cronogramaRecords, activeCronograma?.disciplinasSnapshot || []),
      overallDisciplineProgress: buildDisciplineProgress(records, []),
      overallDisciplineInsights,
      cronogramaDisciplineInsights,
      pendingCycleReviews,
      cronogramaBuckets,
      cronogramaPlan,
      weekOffsetAtual,
      cycleSummary: currentCycleId ? {
        totalSessoes: Number(activeCycle?.totalSessoesCiclo || 0),
        sessoesConcluidas: Array.isArray(activeCycle?.sessoesConcluidas) ? activeCycle.sessoesConcluidas.length : 0,
        tempoSessaoMinutos: Number(activeCycle?.tempoSessaoMinutos || 0),
      } : null,
      cronogramaSummary: currentCronogramaId ? {
        totalHorasSemanais: Number(activeCronograma?.totalHorasSemanais || 0),
        dataInicio: activeCronograma?.dataInicio || null,
        dataFim: activeCronograma?.dataFim || activeCronograma?.dataFechamento || null,
        totalSemanas: Number(activeCronograma?.totalSemanasNecessarias || 0),
        disciplinas: Array.isArray(activeCronograma?.disciplinasSnapshot) ? activeCronograma.disciplinasSnapshot.length : 0,
        edital: getCronogramaLabel(activeCronograma),
        banca: activeCronograma?.banca || null,
      } : null,
      simuladoTrend,
      simuladoSummary: {
        total: simulados.length,
        averageScore: Number(averageSimuladoScore.toFixed(1)),
        bestScore: simuladoTrend.length ? Math.max(...simuladoTrend.map((entry) => entry.score)) : 0,
        latest: simulados[0] || null,
        trend: simuladoTrend.length > 1 ? simuladoTrend[simuladoTrend.length - 1].score - simuladoTrend[simuladoTrend.length - 2].score : 0,
      },
      timeline,
      historyFilters,
      risk,
    };
  }, [activeCronograma, activeCycle, cycleDisciplines, cycleReviews, records, simulados]);

  const loading = useMemo(() => Object.values(ready).some((value) => value === false), [ready]);

  return {
    uid,
    loading,
    records,
    simulados,
    goalsHistory,
    activeCycle,
    cycleDisciplines,
    activeCronograma,
    cycleReviews,
    analytics,
  };
};

export { getRecordDate, getSimuladoDate, getMinutes, getQuestions, getCorrect, toDateSafe };
