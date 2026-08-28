export const USER_FONT_SIZE_OPTIONS = [
  {
    id: 'default',
    label: 'Padrão',
    description: 'Tamanho atual do sistema.',
    mobileScale: 0.9,
    desktopScale: 0.95,
  },
  {
    id: 'large',
    label: 'Maior',
    description: 'Leitura mais confortável.',
    mobileScale: 1,
    desktopScale: 1.05,
  },
  {
    id: 'extraLarge',
    label: 'Muito maior',
    description: 'Máximo conforto visual.',
    mobileScale: 1.08,
    desktopScale: 1.13,
  },
];

const USER_FONT_SIZE_OPTION_MAP = new Map(USER_FONT_SIZE_OPTIONS.map((option) => [option.id, option]));

export const DEFAULT_USER_FONT_SIZE = 'default';
export const USER_FONT_SIZE_STORAGE_KEY = 'modoqap:user-font-size';

export const normalizeUserFontSize = (value) => (
  USER_FONT_SIZE_OPTION_MAP.has(value)
    ? value
    : DEFAULT_USER_FONT_SIZE
);

export const getUserFontSizeOption = (value) => {
  const normalized = normalizeUserFontSize(value);
  return USER_FONT_SIZE_OPTION_MAP.get(normalized) || USER_FONT_SIZE_OPTION_MAP.get(DEFAULT_USER_FONT_SIZE);
};

export const applyUserFontSize = (value, viewportWidth = window.innerWidth) => {
  const option = getUserFontSizeOption(value);
  const scale = viewportWidth < 640 ? option.mobileScale : option.desktopScale;
  document.documentElement.style.setProperty('--app-scale', String(scale));
};
