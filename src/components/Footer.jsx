import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-6 mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-colors">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          © {currentYear} <strong>MODOQAP</strong>. Todos os direitos reservados.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          Desenvolvido para auxiliar sua aprovação.
        </p>
      </div>
    </footer>
  );
};

export default Footer;