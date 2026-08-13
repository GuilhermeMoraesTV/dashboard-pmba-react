export const dismissInitialLoadingScreen = () => {
  if (typeof window === 'undefined') return;

  if (typeof window.__dismissModoQapLoading === 'function') {
    window.__dismissModoQapLoading();
    return;
  }

  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen?.remove();
  document.getElementById('root')?.classList.add('loaded');
};
