import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Check } from 'lucide-react';

const BroadcastReceiver = () => {
    const [notification, setNotification] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    // Verifica se está na Home
    const isHome = location.pathname === '/';

    useEffect(() => {
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
                const timeDiff = now - msgTime;
                const oneDay = 24 * 60 * 60 * 1000; // 24 horas de validade

                const seenMessage = localStorage.getItem(`broadcast_seen_${msgId}`);

                if (msgTime && timeDiff < oneDay && !seenMessage) {
                     setNotification({ ...data, id: msgId });
                     setIsVisible(true);

                     try {
                        const audio = new Audio('/sounds/notification.mp3');
                        // audio.play().catch(e => {});
                     } catch(e) {}
                }
            }
        }, (error) => {
            console.error("Erro ao receber broadcast:", error);
        });
        return () => unsub();
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        if (notification?.id) {
            localStorage.setItem(`broadcast_seen_${notification.id}`, 'true');
        }
    };

    if (!isHome) return null;

    return (
        <AnimatePresence>
            {isVisible && notification && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

                    {/* Backdrop (Fundo Escuro) - SEM CLICK PARA FECHAR */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-not-allowed"
                    />

                    {/* O Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative w-[95%] max-w-md md:max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
                    >
                        {/* --- MARCA D'ÁGUA GRANDE (Logo Inteira) --- */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 dark:opacity-10">
                            <img
                                src="/logo-pmba.png"
                                alt="Logo Sistema"
                                className="w-[80%] h-[80%] object-contain grayscale"
                            />
                        </div>

                        {/* --- CONTEÚDO --- */}
                        <div className="relative z-10 flex flex-col items-center p-5 md:p-8 text-center h-full">

                            {/* Ícone de Topo */}
                            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-500 shadow-inner shrink-0">
                                <Megaphone className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
                            </div>

                            {/* Título */}
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-1 shrink-0">
                                Comunicado Oficial
                            </h2>


                            {/* Mensagem com Scroll */}
                            <div className="w-full bg-zinc-50/80 dark:bg-black/40 rounded-xl p-3 md:p-4 border border-zinc-100 dark:border-zinc-800 mb-4 md:mb-6 backdrop-blur-sm overflow-y-auto max-h-[40vh] md:max-h-[300px] custom-scrollbar">
                                <p className="text-sm md:text-base font-medium text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap text-left md:text-center">
                                    {notification.message}
                                </p>
                            </div>

                            {/* Data e Hora */}
                            <p className="text-[9px] md:text-[10px] text-zinc-400 mb-4 md:mb-6 font-mono shrink-0">
                                Enviado em: {notification.timestamp?.toDate().toLocaleString()}
                            </p>

                            {/* Botão de Ação (ÚNICA FORMA DE FECHAR) */}
                            <button
                                onClick={handleClose}
                                className="w-full py-3 md:py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-wide transition-all transform active:scale-95 shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 shrink-0 text-sm md:text-base"
                            >
                                <Check size={18} strokeWidth={3} />
                                Ciente
                            </button>
                        </div>

                        {/* Barra decorativa inferior */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600 shrink-0" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default BroadcastReceiver;