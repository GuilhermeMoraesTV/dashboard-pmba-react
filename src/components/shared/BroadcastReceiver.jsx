import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Check, Zap, AlertTriangle } from 'lucide-react';

const BroadcastReceiver = () => {
    const [notification, setNotification] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    // Verifica se está na Home
    const isHome = location.pathname === '/';

    useEffect(() => {
        // Se não estiver na home, não ativa o listener
        if (!isHome) return;

        const q = query(
            collection(db, 'system_broadcasts'),
            orderBy('timestamp', 'desc'),
            limit(1)
        );

        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const data = snap.docs[0].data();
                const msgId = snap.docs[0].id;

                const now = new Date();
                const msgTime = data.timestamp?.toDate();

                // Validação de segurança
                if (!msgTime) return;

                const timeDiff = now - msgTime;
                const oneDay = 24 * 60 * 60 * 1000; // Validade de 24h

                // VERIFICAÇÃO RIGOROSA:
                // Se o usuário já tiver clicado em "Ciente" anteriormente, não mostra
                const seenKey = `broadcast_seen_${msgId}`;
                const hasSeen = localStorage.getItem(seenKey);

                if (timeDiff < oneDay && !hasSeen) {
                     setNotification({ ...data, id: msgId });
                     setIsVisible(true);
                }
            }
        });

        return () => unsub();
    }, [isHome]);

    const handleClose = () => {
        if (notification?.id) {
            // Grava que o usuário leu essa mensagem específica
            localStorage.setItem(`broadcast_seen_${notification.id}`, 'true');
            setIsVisible(false);
            setTimeout(() => setNotification(null), 300);
        }
    };

    if (!isHome) return null;

    // --- CONFIGURAÇÃO DE ESTILOS POR TIPO ---
    const getStyleConfig = (type) => {
        switch (type) {
            case 'atualizacao':
                return {
                    icon: Zap,
                    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                    iconColor: 'text-blue-600 dark:text-blue-500',
                    title: 'Nova Atualização',
                    btnBg: 'bg-blue-600 hover:bg-blue-700',
                    gradient: 'from-blue-600 via-cyan-500 to-blue-600',
                    ring: 'ring-blue-50/50 dark:ring-blue-900/5'
                };
            case 'aviso':
                return {
                    icon: AlertTriangle,
                    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
                    iconColor: 'text-amber-600 dark:text-amber-500',
                    title: 'Aviso Importante',
                    btnBg: 'bg-amber-600 hover:bg-amber-700',
                    gradient: 'from-amber-600 via-orange-500 to-amber-600',
                    ring: 'ring-amber-50/50 dark:ring-amber-900/5'
                };
            case 'comunicado':
            default:
                return {
                    icon: Megaphone,
                    iconBg: 'bg-red-50 dark:bg-red-900/20',
                    iconColor: 'text-red-600 dark:text-red-500',
                    title: 'Comunicado Oficial',
                    btnBg: 'bg-red-600 hover:bg-red-700',
                    gradient: 'from-red-600 via-orange-500 to-red-600',
                    ring: 'ring-red-50/50 dark:ring-red-900/5'
                };
        }
    };

    const currentStyle = notification ? getStyleConfig(notification.category) : getStyleConfig('comunicado');
    const CurrentIcon = currentStyle.icon;

    return (
        <AnimatePresence>
            {isVisible && notification && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

                    {/* Backdrop (Fundo Escuro) - BLOQUEADO */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-not-allowed"
                    />

                    {/* O Cartão Oficial */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative w-[95%] max-w-md md:max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
                    >
                        {/* Faixa Decorativa Superior Dinâmica */}
                        <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${currentStyle.gradient} shrink-0`} />

                        {/* --- MARCA D'ÁGUA GRANDE --- */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 dark:opacity-10">
                            <img
                                src="/logo-pmba.png"
                                alt="Logo Sistema"
                                className="w-[80%] h-[80%] object-contain grayscale"
                            />
                        </div>

                        {/* --- CONTEÚDO --- */}
                        <div className="relative z-10 flex flex-col items-center p-5 md:p-8 text-center h-full">

                            {/* Ícone de Topo Dinâmico */}
                            <div className={`mb-4 p-3 rounded-full shadow-inner shrink-0 ${currentStyle.iconBg} ${currentStyle.iconColor} ring-4 ${currentStyle.ring}`}>
                                <CurrentIcon className="w-10 h-10 animate-pulse" />
                            </div>

                            {/* Título Dinâmico */}
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-6 shrink-0">
                                {currentStyle.title}
                            </h2>

                            {/* Mensagem com Scroll */}
                            <div className="w-full bg-zinc-50/80 dark:bg-black/40 rounded-xl p-3 md:p-4 border border-zinc-100 dark:border-zinc-800 mb-5 backdrop-blur-sm overflow-y-auto max-h-[40vh] md:max-h-[300px] custom-scrollbar">
                                <p className="text-sm md:text-base font-medium text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap text-left md:text-center">
                                    {notification.message}
                                </p>
                            </div>

                            {/* Botão de Ação Dinâmico */}
                            <button
                                onClick={handleClose}
                                className={`w-full py-3 text-white rounded-xl font-bold uppercase tracking-wide transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 shrink-0 text-xs md:text-sm ${currentStyle.btnBg}`}
                            >
                                <Check size={16} strokeWidth={3} />
                                Ciente
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default BroadcastReceiver;