import { useLayoutEffect } from 'react';

export const useForceUnlock = () => {
  useLayoutEffect(() => {
    // 🔥 FORÇA a rolagem a aparecer, sobrescrevendo qualquer CSS global
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden'; // Evita rolagem horizontal indesejada

    // Limpa resquícios de position fixed que alguns modais usam
    document.body.style.position = '';
    document.body.style.paddingRight = '';
    document.body.style.top = '';
    document.body.style.width = '';

    // Garante altura automática para o conteúdo empurrar o scroll
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';

    return () => {
      // Opcional: Se quiser que ao sair da página volte ao padrão do CSS
      // document.body.style.overflow = '';
    };
  }, []);
};