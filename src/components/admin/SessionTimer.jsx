import { useState, useEffect, useRef } from 'react';

const toDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const n = Number(value);
  if (!Number.isNaN(n) && n > 0) return new Date(n);
  return null;
};

const toMillisSafe = (value) => {
  const d = toDateSafe(value);
  return d ? d.getTime() : null;
};

// Componente individual para gerenciar o timer de uma sessão específica
const SessionTimer = ({ session }) => {
  const [live, setLive] = useState(0);

  // Usar um ref para armazenar informações únicas por sessão
  const sessionDataRef = useRef({
    lastUpdateTime: Date.now(), // Última vez que atualizamos o estado
    lastSnapshotTime: 0, // Timestamp do último snapshot do servidor
    lastDisplaySeconds: 0, // Valor do último snapshot
    isCurrentlyPaused: false, // Estado de pausa atual
    intervalId: null, // Intervalo de atualização
    sessionUid: null // UID da sessão para garantir consistência
  });

  // Atualizar o estado quando a sessão mudar
  useEffect(() => {
    if (!session) {
      setLive(0);
      sessionDataRef.current.lastUpdateTime = Date.now();
      sessionDataRef.current.lastSnapshotTime = 0;
      sessionDataRef.current.lastDisplaySeconds = 0;
      sessionDataRef.current.isCurrentlyPaused = false;
      sessionDataRef.current.sessionUid = null;
      return;
    }

    // Verificar se é uma sessão diferente para limpar o intervalo anterior
    if (sessionDataRef.current.sessionUid && sessionDataRef.current.sessionUid !== session.uid) {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    }

    sessionDataRef.current.sessionUid = session.uid;

    const isPaused = !!session.isPaused || session.status === 'paused';
    const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);

    // Obter o timestamp do snapshot
    let snapshotTime = 0;
    if (session.snapshotAt) {
      // Se for um timestamp do Firebase, converter para milissegundos
      if (session.snapshotAt?.toDate) {
        const dateObj = session.snapshotAt.toDate();
        if (dateObj && !isNaN(dateObj.getTime())) {
          snapshotTime = dateObj.getTime();
        } else {
          snapshotTime = Date.now(); // fallback
        }
      } else if (typeof session.snapshotAt === 'number') {
        const numValue = Number(session.snapshotAt);
        if (numValue && numValue > 0 && numValue < Date.now() + 86400000) { // não mais que 1 dia no futuro
          snapshotTime = numValue;
        } else {
          snapshotTime = Date.now(); // fallback
        }
      } else {
        snapshotTime = Date.now(); // fallback
      }
    } else {
      snapshotTime = Date.now(); // fallback
    }

    // Validar que o tempo do snapshot é razoável (não muito antigo ou muito no futuro)
    const currentTime = Date.now();
    if (snapshotTime > currentTime + 5000 || snapshotTime < currentTime - 7 * 24 * 60 * 60 * 1000) { // não mais que 7 dias atrás
      snapshotTime = currentTime;
    }

    // Atualizar o estado do ref
    sessionDataRef.current.lastUpdateTime = Date.now();
    sessionDataRef.current.lastSnapshotTime = snapshotTime;
    sessionDataRef.current.lastDisplaySeconds = displaySeconds;
    sessionDataRef.current.isCurrentlyPaused = isPaused;

    // Definir o tempo inicial baseado no estado
    if (isPaused) {
      setLive(displaySeconds);
    } else {
      // Calcular tempo decorrido desde o snapshot
      const timeSinceSnapshot = Math.max(0, (currentTime - snapshotTime) / 1000);
      const calculatedTime = Math.floor(displaySeconds + timeSinceSnapshot);
      setLive(calculatedTime);
    }

  }, [session?.uid, session?.cicloId, session?.createdAt, session?.displaySecondsSnapshot, session?.secondsSnapshot, session?.seconds,
      session?.snapshotAt, session?.timerType, session?.mode, session?.isResting, session?.phase, session?.isPaused, session?.status]);

  // Atualizar o tempo periodicamente se a sessão estiver ativa
  useEffect(() => {
    if (!session) return;

    const isPaused = !!session.isPaused || session.status === 'paused';

    // Limpar intervalo anterior
    if (sessionDataRef.current.intervalId) {
      clearInterval(sessionDataRef.current.intervalId);
      sessionDataRef.current.intervalId = null;
    }

    // Somente iniciar o intervalo se não estiver pausado
    if (!isPaused) {
      // Atualizar o tempo a cada 250ms
      sessionDataRef.current.intervalId = setInterval(() => {
        setLive(prevTime => {
          if (!session) return 0;

          // Verificar se ainda estamos lidando com a mesma sessão
          if (sessionDataRef.current.sessionUid !== session.uid) {
            if (sessionDataRef.current.intervalId) {
              clearInterval(sessionDataRef.current.intervalId);
              sessionDataRef.current.intervalId = null;
            }
            return 0;
          }

          const isNowPaused = !!session.isPaused || session.status === 'paused';
          if (isNowPaused) {
            // Se estiver pausado, usar o tempo do servidor
            const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);
            sessionDataRef.current.lastDisplaySeconds = displaySeconds;
            sessionDataRef.current.isCurrentlyPaused = true;
            return displaySeconds;
          }

          // Calcular tempo decorrido desde o snapshot do servidor
          let snapshotTime = 0;
          if (session.snapshotAt) {
            if (session.snapshotAt?.toDate) {
              const dateObj = session.snapshotAt.toDate();
              if (dateObj && !isNaN(dateObj.getTime())) {
                snapshotTime = dateObj.getTime();
              } else {
                snapshotTime = Date.now();
              }
            } else if (typeof session.snapshotAt === 'number') {
              const numValue = Number(session.snapshotAt);
              if (numValue && numValue > 0 && numValue < Date.now() + 86400000) { // não mais que 1 dia no futuro
                snapshotTime = numValue;
              } else {
                snapshotTime = Date.now();
              }
            } else {
              snapshotTime = Date.now();
            }
          } else {
            snapshotTime = Date.now();
          }

          // Validar que o tempo do snapshot é razoável (não muito antigo ou muito no futuro)
          const currentTime = Date.now();
          if (snapshotTime > currentTime + 5000 || snapshotTime < currentTime - 7 * 24 * 60 * 60 * 1000) { // não mais que 7 dias atrás
            snapshotTime = currentTime;
          }

          const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);

          // Calcular tempo decorrido desde o snapshot do servidor
          const timeSinceSnapshot = Math.max(0, (currentTime - snapshotTime) / 1000);
          const calculatedTime = Math.floor(displaySeconds + timeSinceSnapshot);

          // Atualizar o estado do ref
          sessionDataRef.current.lastUpdateTime = Date.now();
          sessionDataRef.current.lastSnapshotTime = snapshotTime;
          sessionDataRef.current.lastDisplaySeconds = displaySeconds;
          sessionDataRef.current.isCurrentlyPaused = false;

          return Math.max(0, calculatedTime);
        });
      }, 250);
    } else {
      // Se estiver pausado, atualizar imediatamente com o valor do snapshot
      const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);
      setLive(displaySeconds);
    }

    // Cleanup
    return () => {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    };
  }, [session?.uid, session?.isPaused, session?.status, session?.snapshotAt, session?.displaySecondsSnapshot,
      session?.secondsSnapshot, session?.seconds]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    };
  }, []);

  return live;
};

export default SessionTimer;