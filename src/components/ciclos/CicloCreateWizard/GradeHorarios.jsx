import React, { useState, useEffect, useRef } from 'react';

const GradeHorarios = ({ disponibilidade, setDisponibilidade }) => {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const horas = Array.from({ length: 24 }, (_, i) => i);

  const interacaoToque = useRef(false);
  const [arrastando, setArrastando] = useState(false);
  const [modoArrasto, setModoArrasto] = useState(null);

  const atualizarSlot = (indiceDia, hora, forcarEstado = null) => {
    const chave = `${indiceDia}-${hora}`;
    setDisponibilidade(prev => {
        const novoEstado = { ...prev };
        const estadoAtual = !!novoEstado[chave];
        const proximoEstado = forcarEstado !== null ? forcarEstado : !estadoAtual;

        if (proximoEstado) novoEstado[chave] = true;
        else delete novoEstado[chave];

        return novoEstado;
    });
  };

  const lidarMouseDown = (indiceDia, hora) => {
    if (interacaoToque.current) return;
    const chave = `${indiceDia}-${hora}`;
    const valorAtual = !!disponibilidade[chave];
    const novoModo = !valorAtual;
    setModoArrasto(novoModo);
    setArrastando(true);
    atualizarSlot(indiceDia, hora, novoModo);
  };

  const lidarMouseEnter = (indiceDia, hora) => {
    if (arrastando && modoArrasto !== null) {
        atualizarSlot(indiceDia, hora, modoArrasto);
    }
  };

  const lidarMouseUp = () => {
    setArrastando(false);
    setModoArrasto(null);
  };

  const lidarTouchStart = (e, indiceDia, hora) => {
    interacaoToque.current = true;
    setTimeout(() => interacaoToque.current = false, 1000);
    const chave = `${indiceDia}-${hora}`;
    const valorAtual = !!disponibilidade[chave];
    const novoModo = !valorAtual;
    setModoArrasto(novoModo);
    setArrastando(true);
    atualizarSlot(indiceDia, hora, novoModo);
  };

  const lidarTouchMove = (e) => {
    if (!arrastando) return;
    const touch = e.touches[0];
    const alvo = document.elementFromPoint(touch.clientX, touch.clientY);
    if (alvo && alvo.dataset.dia && alvo.dataset.hora) {
        const dia = parseInt(alvo.dataset.dia);
        const h = parseInt(alvo.dataset.hora);
        atualizarSlot(dia, h, modoArrasto);
    }
  };

  const lidarTouchEnd = () => {
    setArrastando(false);
    setModoArrasto(null);
  };

  useEffect(() => {
      window.addEventListener('mouseup', lidarMouseUp);
      return () => window.removeEventListener('mouseup', lidarMouseUp);
  }, []);

  return (
    <div className="h-full flex flex-col select-none">
      <div className="grid grid-cols-8 gap-1 pr-2 mb-2 flex-shrink-0 bg-white dark:bg-card-dark pt-2 pb-2 sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800">
        <div className="text-[10px] font-black text-zinc-300 uppercase text-center pt-2">H</div>
        {dias.map((d, i) => (<div key={i} className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase text-center">{d}</div>))}
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 max-h-[300px]">
        <div className="space-y-1 pb-10">
          {horas.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-1 items-center">
              <div className="text-[10px] sm:text-xs font-bold text-zinc-400 text-center">{h.toString().padStart(2, '0')}:00</div>
              {dias.map((d, indiceDia) => {
                const estaSelecionado = disponibilidade[`${indiceDia}-${h}`];
                return (
                    <div
                        key={`${indiceDia}-${h}`}
                        data-dia={indiceDia}
                        data-hora={h}
                        onMouseDown={() => lidarMouseDown(indiceDia, h)}
                        onMouseEnter={() => lidarMouseEnter(indiceDia, h)}
                        onTouchStart={(e) => lidarTouchStart(e, indiceDia, h)}
                        onTouchMove={lidarTouchMove}
                        onTouchEnd={lidarTouchEnd}
                        className={`h-8 sm:h-9 w-full rounded transition-all duration-100 border flex items-center justify-center cursor-pointer touch-none
                            ${estaSelecionado
                                ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                    />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GradeHorarios;