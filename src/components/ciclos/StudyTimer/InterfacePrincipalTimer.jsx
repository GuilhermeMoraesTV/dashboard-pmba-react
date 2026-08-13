import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Maximize, Minimize2, CheckCircle2, Play, Pause, Square, X } from 'lucide-react';

// ============================================
// CONFIGURAÇÕES DE TAMANHOS - AJUSTE AQUI
// (fora do componente = criado só UMA vez, nunca recriado)
// ============================================
const SIZES = {
    // ==========================================
    // CONFIGURAÇÕES DA LOGO E NOME DO SISTEMA
    // ==========================================

    // --- LOGO E NOME - HORIZONTAL NORMAL (Desktop/Laptop) ---
    LOGO_SYSTEM_NORMAL: {
        LOGO_HEIGHT: '4.5rem',
        LOGO_TOP: '1rem',
        LOGO_LEFT: '1rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1.2rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.15em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.75rem',
        NAME_UPPERCASE: true,
    },
    LOGO_SYSTEM_NORMAL_FULLSCREEN: {
        LOGO_HEIGHT: '5rem',
        LOGO_TOP: '0.75rem',
        LOGO_LEFT: '0.75rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1.2rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.15em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.65rem',
        NAME_UPPERCASE: true,
    },

    // --- LOGO E NOME - HORIZONTAL COMPACTO (Celular deitado) ---
    LOGO_SYSTEM_COMPACT: {
        LOGO_HEIGHT: '3rem',
        LOGO_TOP: '0.5rem',
        LOGO_LEFT: '0.5rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.1em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.5rem',
        NAME_UPPERCASE: true,
    },
    LOGO_SYSTEM_COMPACT_FULLSCREEN: {
        LOGO_HEIGHT: '3rem',
        LOGO_TOP: '0.4rem',
        LOGO_LEFT: '0.4rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.1em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.4rem',
        NAME_UPPERCASE: true,
    },

    // --- LOGO E NOME - VERTICAL TABLET ---
    LOGO_SYSTEM_PORTRAIT_TABLET: {
        LOGO_HEIGHT: '4rem',
        LOGO_TOP: '0.75rem',
        LOGO_LEFT: '0.75rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.125em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.625rem',
        NAME_UPPERCASE: true,
    },
    LOGO_SYSTEM_PORTRAIT_TABLET_FULLSCREEN: {
        LOGO_HEIGHT: '4rem',
        LOGO_TOP: '0.625rem',
        LOGO_LEFT: '0.625rem',
        LOGO_OPACITY: 1,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.125em',
        NAME_OPACITY: 1,
        NAME_MARGIN_LEFT: '0.55rem',
        NAME_UPPERCASE: true,
    },

    // --- LOGO E NOME - VERTICAL MOBILE (Celular) ---
    LOGO_SYSTEM_PORTRAIT_MOBILE: {
        LOGO_HEIGHT: '3rem',
        LOGO_TOP: '0.625rem',
        LOGO_LEFT: '0.625rem',
        LOGO_OPACITY: 0.8,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.1em',
        NAME_OPACITY: 0.8,
        NAME_MARGIN_LEFT: '0.5rem',
        NAME_UPPERCASE: true,
    },
    LOGO_SYSTEM_PORTRAIT_MOBILE_FULLSCREEN: {
        LOGO_HEIGHT: '3rem',
        LOGO_TOP: '0.5rem',
        LOGO_LEFT: '0.5rem',
        LOGO_OPACITY: 0.75,
        SYSTEM_NAME: 'MODOQAP',
        NAME_FONT_SIZE: '1rem',
        NAME_FONT_WEIGHT: '900',
        NAME_COLOR: '#dc2626',
        NAME_TRACKING: '0.1em',
        NAME_OPACITY: 0.75,
        NAME_MARGIN_LEFT: '0.45rem',
        NAME_UPPERCASE: true,
    },

    // ==========================================
    // BADGE DE STATUS
    // ==========================================
    BADGE_NORMAL: {
        PADDING_X: '1.25rem',
        PADDING_Y: '0.5rem',
        FONT_SIZE: '0.75rem',
        DOT_SIZE: '0.5rem',
        GAP: '0.75rem',
        MARGIN_BOTTOM: '1.5rem',
    },
    BADGE_NORMAL_FULLSCREEN: {
        PADDING_X: '1rem',
        PADDING_Y: '0.4rem',
        FONT_SIZE: '0.7rem',
        DOT_SIZE: '0.45rem',
        GAP: '0.6rem',
        MARGIN_BOTTOM: '1.2rem',
    },
    BADGE_COMPACT: {
        PADDING_X: '1rem',
        PADDING_Y: '0.375rem',
        FONT_SIZE: '0.625rem',
        DOT_SIZE: '0.375rem',
        GAP: '0.5rem',
        MARGIN_BOTTOM: '0.5rem',
    },
    BADGE_COMPACT_FULLSCREEN: {
        PADDING_X: '0.875rem',
        PADDING_Y: '0.3rem',
        FONT_SIZE: '0.575rem',
        DOT_SIZE: '0.35rem',
        GAP: '0.4rem',
        MARGIN_BOTTOM: '0.4rem',
    },
    BADGE_PORTRAIT_TABLET: {
        PADDING_X: '1rem',
        PADDING_Y: '0.4rem',
        FONT_SIZE: '0.7rem',
        DOT_SIZE: '0.4rem',
        GAP: '0.6rem',
        MARGIN_BOTTOM: '1rem',
    },
    BADGE_PORTRAIT_TABLET_FULLSCREEN: {
        PADDING_X: '0.875rem',
        PADDING_Y: '0.35rem',
        FONT_SIZE: '0.65rem',
        DOT_SIZE: '0.375rem',
        GAP: '0.5rem',
        MARGIN_BOTTOM: '0.85rem',
    },
    BADGE_PORTRAIT_MOBILE: {
        PADDING_X: '0.875rem',
        PADDING_Y: '0.35rem',
        FONT_SIZE: '0.625rem',
        DOT_SIZE: '0.35rem',
        GAP: '0.5rem',
        MARGIN_BOTTOM: '0.75rem',
    },
    BADGE_PORTRAIT_MOBILE_FULLSCREEN: {
        PADDING_X: '0.75rem',
        PADDING_Y: '0.3rem',
        FONT_SIZE: '0.575rem',
        DOT_SIZE: '0.325rem',
        GAP: '0.4rem',
        MARGIN_BOTTOM: '0.6rem',
    },

    // ==========================================
    // TÍTULO / DISCIPLINA
    // ==========================================
    TITLE_NORMAL:                    { FONT_SIZE: '2rem',    MARGIN_BOTTOM: '0.5rem' },
    TITLE_NORMAL_FULLSCREEN:         { FONT_SIZE: '1.75rem', MARGIN_BOTTOM: '0.4rem' },
    TITLE_COMPACT:                   { FONT_SIZE: '2rem',    MARGIN_BOTTOM: '0.25rem' },
    TITLE_COMPACT_FULLSCREEN:        { FONT_SIZE: '1.75rem', MARGIN_BOTTOM: '0.2rem' },
    TITLE_PORTRAIT_TABLET:           { FONT_SIZE: '2rem',    MARGIN_BOTTOM: '0.4rem' },
    TITLE_PORTRAIT_TABLET_FULLSCREEN:{ FONT_SIZE: '2rem',    MARGIN_BOTTOM: '0.35rem' },
    TITLE_PORTRAIT_MOBILE:           { FONT_SIZE: '1.25rem', MARGIN_BOTTOM: '0.3rem' },
    TITLE_PORTRAIT_MOBILE_FULLSCREEN:{ FONT_SIZE: '1.15rem', MARGIN_BOTTOM: '0.25rem' },

    // ==========================================
    // ASSUNTO / SUBTÍTULO
    // ==========================================
    SUBTITLE_NORMAL:                    { FONT_SIZE: '1rem',    MARGIN_BOTTOM: '0.75rem' },
    SUBTITLE_NORMAL_FULLSCREEN:         { FONT_SIZE: '0.9rem',  MARGIN_BOTTOM: '0.6rem' },
    SUBTITLE_COMPACT:                   { FONT_SIZE: '1rem',    MARGIN_BOTTOM: '0.25rem' },
    SUBTITLE_COMPACT_FULLSCREEN:        { FONT_SIZE: '1rem',    MARGIN_BOTTOM: '0.2rem' },
    SUBTITLE_PORTRAIT_TABLET:           { FONT_SIZE: '1rem',    MARGIN_BOTTOM: '0.5rem' },
    SUBTITLE_PORTRAIT_TABLET_FULLSCREEN:{ FONT_SIZE: '1rem',    MARGIN_BOTTOM: '0.4rem' },
    SUBTITLE_PORTRAIT_MOBILE:           { FONT_SIZE: '0.75rem', MARGIN_BOTTOM: '0.4rem' },
    SUBTITLE_PORTRAIT_MOBILE_FULLSCREEN:{ FONT_SIZE: '0.7rem',  MARGIN_BOTTOM: '0.3rem' },

    // ==========================================
    // CRONÔMETRO
    // ==========================================
    CLOCK_NORMAL:                    { FONT_SIZE: '17rem', MARGIN_BOTTOM: '3rem' },
    CLOCK_NORMAL_FULLSCREEN:         { FONT_SIZE: '18rem', MARGIN_BOTTOM: '2.5rem' },
    CLOCK_COMPACT:                   { FONT_SIZE: '7rem',  MARGIN_BOTTOM: '0.75rem' },
    CLOCK_COMPACT_FULLSCREEN:        { FONT_SIZE: '8rem',  MARGIN_BOTTOM: '0.6rem' },
    CLOCK_PORTRAIT_TABLET:           { FONT_SIZE: '12rem', MARGIN_BOTTOM: '2rem' },
    CLOCK_PORTRAIT_TABLET_FULLSCREEN:{ FONT_SIZE: '12rem', MARGIN_BOTTOM: '1.75rem' },
    CLOCK_PORTRAIT_MOBILE:           { FONT_SIZE: '5rem',  MARGIN_BOTTOM: '1.5rem' },
    CLOCK_PORTRAIT_MOBILE_FULLSCREEN:{ FONT_SIZE: '5rem',  MARGIN_BOTTOM: '1.25rem' },

    // ==========================================
    // SOMBRA DO CRONÔMETRO
    // ==========================================
    CLOCK_SHADOW_NORMAL:                    { INSET: '-2.5rem', BLUR: '60px', OPACITY: 0.2 },
    CLOCK_SHADOW_NORMAL_FULLSCREEN:         { INSET: '-3rem',   BLUR: '70px', OPACITY: 0.25 },
    CLOCK_SHADOW_COMPACT:                   { INSET: '-1.5rem', BLUR: '40px', OPACITY: 0.15 },
    CLOCK_SHADOW_COMPACT_FULLSCREEN:        { INSET: '-1.75rem',BLUR: '45px', OPACITY: 0.18 },
    CLOCK_SHADOW_PORTRAIT_TABLET:           { INSET: '-2rem',   BLUR: '50px', OPACITY: 0.18 },
    CLOCK_SHADOW_PORTRAIT_TABLET_FULLSCREEN:{ INSET: '-2.5rem', BLUR: '60px', OPACITY: 0.22 },
    CLOCK_SHADOW_PORTRAIT_MOBILE:           { INSET: '-1.5rem', BLUR: '40px', OPACITY: 0.15 },
    CLOCK_SHADOW_PORTRAIT_MOBILE_FULLSCREEN:{ INSET: '-2rem',   BLUR: '50px', OPACITY: 0.18 },

    // ==========================================
    // BOTÕES LATERAIS
    // ==========================================
    SIDE_BUTTON_NORMAL:                    { WIDTH: '3.5rem',  HEIGHT: '3.5rem',  ICON_SIZE: 24, LABEL_SIZE: '0.625rem', GAP: '0.5rem' },
    SIDE_BUTTON_NORMAL_FULLSCREEN:         { WIDTH: '4rem',    HEIGHT: '4rem',    ICON_SIZE: 26, LABEL_SIZE: '0.7rem',   GAP: '0.6rem' },
    SIDE_BUTTON_COMPACT:                   { WIDTH: '2.5rem',  HEIGHT: '2.5rem',  ICON_SIZE: 20, LABEL_SIZE: '0.625rem', GAP: '0.125rem' },
    SIDE_BUTTON_COMPACT_FULLSCREEN:        { WIDTH: '2.75rem', HEIGHT: '2.75rem', ICON_SIZE: 22, LABEL_SIZE: '0.65rem',  GAP: '0.15rem' },
    SIDE_BUTTON_PORTRAIT_TABLET:           { WIDTH: '4rem',    HEIGHT: '4rem',    ICON_SIZE: 20, LABEL_SIZE: '0.6rem',   GAP: '0.4rem' },
    SIDE_BUTTON_PORTRAIT_TABLET_FULLSCREEN:{ WIDTH: '4.5rem',  HEIGHT: '4.5rem',  ICON_SIZE: 22, LABEL_SIZE: '0.65rem',  GAP: '0.5rem' },
    SIDE_BUTTON_PORTRAIT_MOBILE:           { WIDTH: '3rem',    HEIGHT: '3rem',    ICON_SIZE: 20, LABEL_SIZE: '0.55rem',  GAP: '0.3rem' },
    SIDE_BUTTON_PORTRAIT_MOBILE_FULLSCREEN:{ WIDTH: '3rem',    HEIGHT: '3rem',    ICON_SIZE: 22, LABEL_SIZE: '0.6rem',   GAP: '0.35rem' },

    // ==========================================
    // BOTÃO CENTRAL
    // ==========================================
    CENTER_BUTTON_NORMAL:                    { WIDTH: '6rem',   HEIGHT: '6rem',   ICON_SIZE: 36, LABEL_SIZE: '0.75rem',  LABEL_MARGIN_TOP: '0.5rem' },
    CENTER_BUTTON_NORMAL_FULLSCREEN:         { WIDTH: '7rem',   HEIGHT: '7rem',   ICON_SIZE: 40, LABEL_SIZE: '0.85rem',  LABEL_MARGIN_TOP: '0.6rem' },
    CENTER_BUTTON_COMPACT:                   { WIDTH: '4rem',   HEIGHT: '4rem',   ICON_SIZE: 28, LABEL_SIZE: '0.625rem', LABEL_MARGIN_TOP: '0.25rem' },
    CENTER_BUTTON_COMPACT_FULLSCREEN:        { WIDTH: '4.5rem', HEIGHT: '4.5rem', ICON_SIZE: 30, LABEL_SIZE: '0.65rem',  LABEL_MARGIN_TOP: '0.3rem' },
    CENTER_BUTTON_PORTRAIT_TABLET:           { WIDTH: '5rem',   HEIGHT: '5rem',   ICON_SIZE: 32, LABEL_SIZE: '0.7rem',   LABEL_MARGIN_TOP: '0.4rem' },
    CENTER_BUTTON_PORTRAIT_TABLET_FULLSCREEN:{ WIDTH: '5.5rem', HEIGHT: '5.5rem', ICON_SIZE: 34, LABEL_SIZE: '0.75rem',  LABEL_MARGIN_TOP: '0.45rem' },
    CENTER_BUTTON_PORTRAIT_MOBILE:           { WIDTH: '4rem',   HEIGHT: '4rem',   ICON_SIZE: 28, LABEL_SIZE: '0.625rem', LABEL_MARGIN_TOP: '0.3rem' },
    CENTER_BUTTON_PORTRAIT_MOBILE_FULLSCREEN:{ WIDTH: '4.5rem', HEIGHT: '4.5rem', ICON_SIZE: 30, LABEL_SIZE: '0.65rem',  LABEL_MARGIN_TOP: '0.35rem' },

    // ==========================================
    // GAP ENTRE BOTÕES
    // ==========================================
    BUTTONS_GAP_NORMAL:                    '1.5rem',
    BUTTONS_GAP_NORMAL_FULLSCREEN:         '2rem',
    BUTTONS_GAP_COMPACT:                   '1rem',
    BUTTONS_GAP_COMPACT_FULLSCREEN:        '1.25rem',
    BUTTONS_GAP_PORTRAIT_TABLET:           '1.25rem',
    BUTTONS_GAP_PORTRAIT_TABLET_FULLSCREEN:'1.5rem',
    BUTTONS_GAP_PORTRAIT_MOBILE:           '1rem',
    BUTTONS_GAP_PORTRAIT_MOBILE_FULLSCREEN:'1.25rem',

    // ==========================================
    // CONTAINER PRINCIPAL
    // ==========================================
    CONTAINER_NORMAL:                    { MARGIN_TOP: '5rem',  PADDING_TOP: '0' },
    CONTAINER_NORMAL_FULLSCREEN:         { MARGIN_TOP: '3rem',  PADDING_TOP: '0' },
    CONTAINER_COMPACT:                   { MARGIN_TOP: '0',     PADDING_TOP: '0.5rem' },
    CONTAINER_COMPACT_FULLSCREEN:        { MARGIN_TOP: '0',     PADDING_TOP: '0.3rem' },
    CONTAINER_PORTRAIT_TABLET:           { MARGIN_TOP: '4rem',  PADDING_TOP: '0' },
    CONTAINER_PORTRAIT_TABLET_FULLSCREEN:{ MARGIN_TOP: '3rem',  PADDING_TOP: '0' },
    CONTAINER_PORTRAIT_MOBILE:           { MARGIN_TOP: '3rem',  PADDING_TOP: '0' },
    CONTAINER_PORTRAIT_MOBILE_FULLSCREEN:{ MARGIN_TOP: '2rem',  PADDING_TOP: '0' },
};

// Mapeamento de modos para tamanhos (fora do componente = criado só UMA vez)
const MODE_MAP = {
    'normal':                    { logoSystem: SIZES.LOGO_SYSTEM_NORMAL,                    badge: SIZES.BADGE_NORMAL,                    title: SIZES.TITLE_NORMAL,                    subtitle: SIZES.SUBTITLE_NORMAL,                    clock: SIZES.CLOCK_NORMAL,                    clockShadow: SIZES.CLOCK_SHADOW_NORMAL,                    sideButton: SIZES.SIDE_BUTTON_NORMAL,                    centerButton: SIZES.CENTER_BUTTON_NORMAL,                    buttonsGap: SIZES.BUTTONS_GAP_NORMAL,                    container: SIZES.CONTAINER_NORMAL },
    'normal_fullscreen':         { logoSystem: SIZES.LOGO_SYSTEM_NORMAL_FULLSCREEN,         badge: SIZES.BADGE_NORMAL_FULLSCREEN,         title: SIZES.TITLE_NORMAL_FULLSCREEN,         subtitle: SIZES.SUBTITLE_NORMAL_FULLSCREEN,         clock: SIZES.CLOCK_NORMAL_FULLSCREEN,         clockShadow: SIZES.CLOCK_SHADOW_NORMAL_FULLSCREEN,         sideButton: SIZES.SIDE_BUTTON_NORMAL_FULLSCREEN,         centerButton: SIZES.CENTER_BUTTON_NORMAL_FULLSCREEN,         buttonsGap: SIZES.BUTTONS_GAP_NORMAL_FULLSCREEN,         container: SIZES.CONTAINER_NORMAL_FULLSCREEN },
    'compact':                   { logoSystem: SIZES.LOGO_SYSTEM_COMPACT,                   badge: SIZES.BADGE_COMPACT,                   title: SIZES.TITLE_COMPACT,                   subtitle: SIZES.SUBTITLE_COMPACT,                   clock: SIZES.CLOCK_COMPACT,                   clockShadow: SIZES.CLOCK_SHADOW_COMPACT,                   sideButton: SIZES.SIDE_BUTTON_COMPACT,                   centerButton: SIZES.CENTER_BUTTON_COMPACT,                   buttonsGap: SIZES.BUTTONS_GAP_COMPACT,                   container: SIZES.CONTAINER_COMPACT },
    'compact_fullscreen':        { logoSystem: SIZES.LOGO_SYSTEM_COMPACT_FULLSCREEN,        badge: SIZES.BADGE_COMPACT_FULLSCREEN,        title: SIZES.TITLE_COMPACT_FULLSCREEN,        subtitle: SIZES.SUBTITLE_COMPACT_FULLSCREEN,        clock: SIZES.CLOCK_COMPACT_FULLSCREEN,        clockShadow: SIZES.CLOCK_SHADOW_COMPACT_FULLSCREEN,        sideButton: SIZES.SIDE_BUTTON_COMPACT_FULLSCREEN,        centerButton: SIZES.CENTER_BUTTON_COMPACT_FULLSCREEN,        buttonsGap: SIZES.BUTTONS_GAP_COMPACT_FULLSCREEN,        container: SIZES.CONTAINER_COMPACT_FULLSCREEN },
    'portrait_tablet':           { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_TABLET,           badge: SIZES.BADGE_PORTRAIT_TABLET,           title: SIZES.TITLE_PORTRAIT_TABLET,           subtitle: SIZES.SUBTITLE_PORTRAIT_TABLET,           clock: SIZES.CLOCK_PORTRAIT_TABLET,           clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_TABLET,           sideButton: SIZES.SIDE_BUTTON_PORTRAIT_TABLET,           centerButton: SIZES.CENTER_BUTTON_PORTRAIT_TABLET,           buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_TABLET,           container: SIZES.CONTAINER_PORTRAIT_TABLET },
    'portrait_tablet_fullscreen':{ logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_TABLET_FULLSCREEN,badge: SIZES.BADGE_PORTRAIT_TABLET_FULLSCREEN,title: SIZES.TITLE_PORTRAIT_TABLET_FULLSCREEN,subtitle: SIZES.SUBTITLE_PORTRAIT_TABLET_FULLSCREEN,clock: SIZES.CLOCK_PORTRAIT_TABLET_FULLSCREEN,clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_TABLET_FULLSCREEN,sideButton: SIZES.SIDE_BUTTON_PORTRAIT_TABLET_FULLSCREEN,centerButton: SIZES.CENTER_BUTTON_PORTRAIT_TABLET_FULLSCREEN,buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_TABLET_FULLSCREEN,container: SIZES.CONTAINER_PORTRAIT_TABLET_FULLSCREEN },
    'portrait_mobile':           { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_MOBILE,           badge: SIZES.BADGE_PORTRAIT_MOBILE,           title: SIZES.TITLE_PORTRAIT_MOBILE,           subtitle: SIZES.SUBTITLE_PORTRAIT_MOBILE,           clock: SIZES.CLOCK_PORTRAIT_MOBILE,           clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_MOBILE,           sideButton: SIZES.SIDE_BUTTON_PORTRAIT_MOBILE,           centerButton: SIZES.CENTER_BUTTON_PORTRAIT_MOBILE,           buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_MOBILE,           container: SIZES.CONTAINER_PORTRAIT_MOBILE },
    'portrait_mobile_fullscreen':{ logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_MOBILE_FULLSCREEN,badge: SIZES.BADGE_PORTRAIT_MOBILE_FULLSCREEN,title: SIZES.TITLE_PORTRAIT_MOBILE_FULLSCREEN,subtitle: SIZES.SUBTITLE_PORTRAIT_MOBILE_FULLSCREEN,clock: SIZES.CLOCK_PORTRAIT_MOBILE_FULLSCREEN,clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_MOBILE_FULLSCREEN,sideButton: SIZES.SIDE_BUTTON_PORTRAIT_MOBILE_FULLSCREEN,centerButton: SIZES.CENTER_BUTTON_PORTRAIT_MOBILE_FULLSCREEN,buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_MOBILE_FULLSCREEN,container: SIZES.CONTAINER_PORTRAIT_MOBILE_FULLSCREEN },
};
// ============================================
// FIM DAS CONFIGURAÇÕES
// ============================================

const InterfacePrincipalTimer = ({
    themeColor,
    isDark,
    isFullscreen,
    isPreparing,
    countdown,
    isPaused,
    variant,
    effectiveMode,
    isResting,
    isPomodoro,
    disciplina,
    assunto,
    totalFocusSeconds,
    seconds,
    finishText,
    formatClock,
    formatHM,
    onToggleTheme,
    onToggleFullscreen,
    onMinimize,
    onRestComplete,
    onOpenCancelModal,
    onTogglePause,
    onStop
}) => {
    const [viewMode, setViewMode] = useState('normal');

    useEffect(() => {
        const checkSize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isLandscape = width > height;

            let mode = 'normal';

            if (!isLandscape) {
                if (width < 768) {
                    mode = isFullscreen ? 'portrait_mobile_fullscreen' : 'portrait_mobile';
                } else {
                    mode = isFullscreen ? 'portrait_tablet_fullscreen' : 'portrait_tablet';
                }
            } else {
                if (width <= 960 && height <= 570) {
                    mode = isFullscreen ? 'compact_fullscreen' : 'compact';
                } else {
                    mode = isFullscreen ? 'normal_fullscreen' : 'normal';
                }
            }

            setViewMode(mode);
        };

        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, [isFullscreen]);

    const sizes = MODE_MAP[viewMode] || MODE_MAP['normal'];
    const showLabels = !viewMode.startsWith('compact');

    return (
        <div className="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-background-dark flex flex-col items-center justify-center animate-fade-in overflow-hidden font-sans">

            {/* Background */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                    backgroundSize: '40px 40px',
                    color: themeColor
                }}
            />
            <div
                className="absolute top-0 left-0 w-full h-1 opacity-50"
                style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}
            />

            {/* Logo e Nome do Sistema - SEMPRE NO CANTO SUPERIOR ESQUERDO */}
            <div
                className="absolute flex items-center pointer-events-none z-20"
                style={{
                    top: sizes.logoSystem.LOGO_TOP,
                    left: sizes.logoSystem.LOGO_LEFT,
                }}
            >
                <img
                    src="/logoModoQAP.png"
                    alt="Logo"
                    className="drop-shadow-2xl grayscale-[0.2]"
                    style={{
                        height: sizes.logoSystem.LOGO_HEIGHT,
                        width: 'auto',
                        opacity: sizes.logoSystem.LOGO_OPACITY
                    }}
                />
                <h1
                    style={{
                        fontSize: sizes.logoSystem.NAME_FONT_SIZE,
                        fontWeight: sizes.logoSystem.NAME_FONT_WEIGHT,
                        color: sizes.logoSystem.NAME_COLOR,
                        letterSpacing: sizes.logoSystem.NAME_TRACKING,
                        opacity: sizes.logoSystem.NAME_OPACITY,
                        marginLeft: sizes.logoSystem.NAME_MARGIN_LEFT,
                        textTransform: sizes.logoSystem.NAME_UPPERCASE ? 'uppercase' : 'none',
                    }}
                >
                    {sizes.logoSystem.SYSTEM_NAME}
                </h1>
            </div>

            {/* Controles Superiores */}
            <div className="absolute top-4 right-4 flex gap-2 z-[100]">
                <button
                    onClick={onToggleTheme}
                    className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm"
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                    onClick={onToggleFullscreen}
                    className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm"
                >
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
                </button>
                <button
                    onClick={onMinimize}
                    className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all px-4 py-2 rounded-full shadow-sm"
                >
                    <Minimize2 size={20} />
                    <span className="hidden md:inline text-sm font-bold uppercase tracking-wide">
                        Minimizar
                    </span>
                </button>
            </div>

            {/* Countdown */}
            <AnimatePresence>
                {isPreparing && (
                    <motion.div
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ backgroundColor: isDark ? '#09090b' : '#fafafa' }}
                    >
                        <motion.div
                            key={countdown}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative font-black drop-shadow-2xl text-[10rem] md:text-[15rem]"
                        >
                            <div
                                className="absolute inset-0 rounded-full blur-[60px]"
                                style={{ backgroundColor: themeColor, opacity: 0.3 }}
                            />
                            <span className="relative z-10 text-black dark:text-white">
                                {countdown > 0 ? countdown : "GO!"}
                            </span>
                        </motion.div>
                        <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold text-center px-4">
                            {variant === 'simulado' ? 'Iniciando Simulado' : 'Preparar Foco'}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Conteúdo Principal */}
            <div
                className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4"
                style={{
                    marginTop: sizes.container.MARGIN_TOP,
                    paddingTop: sizes.container.PADDING_TOP
                }}
            >
                {/* Badge de Status */}
                <div
                    className="rounded-full border font-bold tracking-[0.2em] uppercase flex items-center transition-colors shadow-sm bg-white dark:bg-zinc-900"
                    style={{
                        borderColor: `${themeColor}40`,
                        color: themeColor,
                        paddingLeft: sizes.badge.PADDING_X,
                        paddingRight: sizes.badge.PADDING_X,
                        paddingTop: sizes.badge.PADDING_Y,
                        paddingBottom: sizes.badge.PADDING_Y,
                        fontSize: sizes.badge.FONT_SIZE,
                        gap: sizes.badge.GAP,
                        marginBottom: sizes.badge.MARGIN_BOTTOM,
                    }}
                >
                    <span
                        className={`rounded-full ${isPaused ? 'bg-zinc-400' : 'animate-pulse'}`}
                        style={{
                            width: sizes.badge.DOT_SIZE,
                            height: sizes.badge.DOT_SIZE,
                            backgroundColor: isPaused ? undefined : themeColor
                        }}
                    />
                    {variant === 'simulado'
                        ? (isPaused ? 'Simulado Pausado' : (effectiveMode === 'countdown' ? 'Cronômetro' : 'Tempo Livre'))
                        : (isResting ? 'Modo Descanso' : (isPaused ? 'Pausado' : (isPomodoro ? 'Modo Pomodoro' : 'Modo Livre')))}
                </div>

                {/* Título/Disciplina */}
                <h2
                    className="font-bold text-zinc-800 dark:text-zinc-300 tracking-tight max-w-3xl leading-tight line-clamp-2"
                    style={{
                        fontSize: sizes.title.FONT_SIZE,
                        marginBottom: sizes.title.MARGIN_BOTTOM
                    }}
                >
                    {disciplina?.nome || 'Disciplina'}
                </h2>

                {/* Assunto/Subtítulo */}
                {assunto && (
                    <p
                        className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wide line-clamp-1"
                        style={{
                            fontSize: sizes.subtitle.FONT_SIZE,
                            marginBottom: sizes.subtitle.MARGIN_BOTTOM
                        }}
                    >
                        {assunto}
                    </p>
                )}

                {/* Total Pomodoro */}
                {isPomodoro && variant !== 'simulado' && (
                    <p
                        className="text-zinc-500 dark:text-zinc-400"
                        style={{
                            fontSize: sizes.subtitle.FONT_SIZE,
                            marginBottom: sizes.subtitle.MARGIN_BOTTOM
                        }}
                    >
                        Total: <span className="font-black">{formatHM(totalFocusSeconds)}</span>
                    </p>
                )}

                {/* Cronômetro com Sombra Colorida */}
                <div
                    className="relative"
                    style={{ marginBottom: sizes.clock.MARGIN_BOTTOM }}
                >
                    {/* Sombra colorida */}
                    <div
                        className="absolute rounded-full transition-colors duration-700 pointer-events-none"
                        style={{
                            inset: sizes.clockShadow.INSET,
                            filter: `blur(${sizes.clockShadow.BLUR})`,
                            opacity: sizes.clockShadow.OPACITY,
                            backgroundColor: isPaused ? '#71717a' : themeColor
                        }}
                    />
                    {/* Números */}
                    <div
                        className="font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl relative z-10"
                        style={{
                            fontSize: sizes.clock.FONT_SIZE,
                            color: isPaused ? '#a1a1aa' : (variant !== 'simulado' && isResting ? '#3B82F6' : '#18181b')
                        }}
                    >
                        <span className={`${isPaused ? 'text-zinc-400' : (variant !== 'simulado' && isResting ? 'text-blue-500' : 'text-zinc-900 dark:text-white')}`}>
                            {formatClock(seconds)}
                        </span>
                    </div>
                </div>

                {/* Botões de Controle */}
                <div className="flex items-center" style={{ gap: sizes.buttonsGap }}>

                    {/* Botão Esquerdo */}
                    {variant !== 'simulado' && isResting ? (
                        <button
                            onClick={onRestComplete}
                            className="group flex flex-col items-center text-zinc-400 hover:text-blue-500 transition-colors"
                            style={{ gap: sizes.sideButton.GAP }}
                        >
                            <div
                                className="rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-blue-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm"
                                style={{ width: sizes.sideButton.WIDTH, height: sizes.sideButton.HEIGHT }}
                            >
                                <CheckCircle2 size={sizes.sideButton.ICON_SIZE} />
                            </div>
                            {showLabels && (
                                <span className="font-bold uppercase tracking-wider text-center" style={{ fontSize: sizes.sideButton.LABEL_SIZE }}>
                                    Fim Descanso
                                </span>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={onOpenCancelModal}
                            className="group flex flex-col items-center text-zinc-400 hover:text-red-500 transition-colors"
                            style={{ gap: sizes.sideButton.GAP }}
                        >
                            <div
                                className="rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm"
                                style={{ width: sizes.sideButton.WIDTH, height: sizes.sideButton.HEIGHT }}
                            >
                                <X size={sizes.sideButton.ICON_SIZE} />
                            </div>
                            {showLabels && (
                                <span className="font-bold uppercase tracking-wider text-center" style={{ fontSize: sizes.sideButton.LABEL_SIZE }}>
                                    Cancelar
                                </span>
                            )}
                        </button>
                    )}

                    {/* Botão Central */}
                    <button
                        onClick={onTogglePause}
                        className="rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-white"
                        style={{
                            backgroundColor: isPaused ? themeColor : '#f59e0b',
                            width: sizes.centerButton.WIDTH,
                            height: sizes.centerButton.HEIGHT
                        }}
                    >
                        {isPaused
                            ? <Play size={sizes.centerButton.ICON_SIZE} className="ml-0.5" fill="currentColor" />
                            : <Pause size={sizes.centerButton.ICON_SIZE} fill="currentColor" />
                        }
                        {showLabels && (
                            <span className="font-bold uppercase" style={{ fontSize: sizes.centerButton.LABEL_SIZE, marginTop: sizes.centerButton.LABEL_MARGIN_TOP }}>
                                {isPaused ? 'Retomar' : 'Pausar'}
                            </span>
                        )}
                    </button>

                    {/* Botão Direito */}
                    <button
                        onClick={onStop}
                        className="group flex flex-col items-center text-zinc-400 hover:text-emerald-500 transition-colors"
                        style={{ gap: sizes.sideButton.GAP }}
                    >
                        <div
                            className="rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm"
                            style={{ width: sizes.sideButton.WIDTH, height: sizes.sideButton.HEIGHT }}
                        >
                            <Square size={sizes.sideButton.ICON_SIZE} fill="currentColor" />
                        </div>
                        {showLabels && (
                            <span className="font-bold uppercase tracking-wider text-center" style={{ fontSize: sizes.sideButton.LABEL_SIZE }}>
                                {finishText || (variant === 'simulado' ? 'Finalizar' : 'Salvar')}
                            </span>
                        )}
                    </button>

                </div>
            </div>
        </div>
    );
};

export default InterfacePrincipalTimer;
