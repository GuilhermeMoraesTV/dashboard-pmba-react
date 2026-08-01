import React, { useEffect, useId, useRef } from 'react';
import Coloris from '@melloware/coloris';
import '@melloware/coloris/dist/coloris.css';

const DEFAULT_SWATCHES = [
  '#dc2626',
  '#ea580c',
  '#f59e0b',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#be185d',
  '#52525b',
  '#111827',
  '#ffffff',
];

let colorisReady = false;

const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '');

export default function ColorisSwatch({
  value,
  onChange,
  label,
  className = '',
  swatches = DEFAULT_SWATCHES,
  sizeClass = 'h-10 w-10',
  inputClassName = '',
}) {
  const generatedId = useId().replace(/:/g, '');
  const inputRef = useRef(null);
  const safeValue = isHexColor(value) ? value : '#71717a';

  useEffect(() => {
    if (!colorisReady) {
      Coloris.init();
      colorisReady = true;
    }
  }, []);

  useEffect(() => {
    if (!inputRef.current) return;
    Coloris({
      el: inputRef.current,
      theme: 'polaroid',
      themeMode: 'auto',
      format: 'hex',
      formatToggle: false,
      alpha: false,
      clearButton: false,
      closeButton: true,
      closeLabel: 'Fechar',
      swatches,
      wrap: false,
      a11y: {
        open: 'Abrir seletor de cor',
        close: 'Fechar seletor de cor',
        clear: 'Limpar cor',
        marker: 'Saturacao: {s}. Brilho: {v}.',
        hueSlider: 'Matiz',
        alphaSlider: 'Opacidade',
        input: 'Cor',
        format: 'Formato',
        swatch: 'Amostra de cor',
        instruction: 'Use as setas para ajustar a cor.',
      },
    });
  }, [swatches]);

  const handleColorChange = (event) => {
    const next = event.target.value;
    if (isHexColor(next)) onChange?.(next.toUpperCase());
  };

  return (
    <label
      htmlFor={`coloris-${generatedId}`}
      className={`relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm transition-transform active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 ${sizeClass} ${className}`}
      style={{ backgroundColor: safeValue }}
      title={label}
    >
      <span className="sr-only">{label || 'Escolher cor'}</span>
      <input
        ref={inputRef}
        id={`coloris-${generatedId}`}
        type="text"
        value={safeValue}
        onInput={handleColorChange}
        onChange={handleColorChange}
        data-coloris
        aria-label={label || 'Escolher cor'}
        className={`absolute inset-0 h-full w-full cursor-pointer opacity-0 ${inputClassName}`}
      />
    </label>
  );
}
