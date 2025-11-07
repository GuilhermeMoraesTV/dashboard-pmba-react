import React from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * Um modal de confirmação visual reutilizável.
 * * Props:
 * - isOpen (boolean): Controla se o modal está visível.
 * - onClose (function): Função chamada ao fechar (clique no 'X' ou fora).
 * - onConfirm (function): Função chamada ao clicar no botão de confirmação.
 * - title (string): O título do modal.
 * - message (string): O texto/mensagem de confirmação.
 * - confirmText (string): Texto do botão de confirmação (padrão: "Confirmar").
 * - cancelText (string): Texto do botão de cancelar (padrão: "Cancelar").
 * - isLoading (boolean): Mostra um spinner de carregamento no botão de confirmação.
 * - isDestructive (boolean): Se true, estiliza o botão de confirmação como "destrutivo" (vermelho).
 */
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  isDestructive = true
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 m-4 bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-lg border border-border-color dark:border-dark-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="flex items-start space-x-4">
          {/* Ícone */}
          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${isDestructive ? 'bg-red-200 dark:bg-red-900' : 'bg-primary-light dark:bg-primary-dark'}`}>
            <AlertTriangle size={24} className={`${isDestructive ? 'text-danger-color' : 'text-primary'}`} />
          </div>

          {/* Conteúdo */}
          <div className="flex-grow">
            <h2 className="mt-0 mb-2 text-xl font-bold text-heading-color dark:text-dark-heading-color border-none p-0">
              {title}
            </h2>
            <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
              {message}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg font-semibold bg-gray-200 dark:bg-dark-border-color text-gray-800 dark:text-dark-text-color hover:bg-gray-300 dark:hover:bg-border-color transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-60
              ${isDestructive
                ? 'bg-danger-color hover:bg-red-700'
                : 'bg-primary-DEFAULT hover:bg-primary-hover'
              }
            `}
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? "Processando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;