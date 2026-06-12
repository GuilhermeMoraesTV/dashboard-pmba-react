import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db, auth } from '../../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Check, Zap, AlertTriangle, Bell, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Quantas vezes o broadcast pode aparecer antes de ser silenciado
// Admin sempre vê sem limite (para preview). Usuários normais respeitam este valor.
const MAX_VIEWS = 2;

const toMillisSafe = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};

const getAuthCreatedAtMillis = (user) => (
    toMillisSafe(user?.metadata?.creationTime) ||
    toMillisSafe(user?.metadata?.createdAt) ||
    null
);

const BroadcastReceiver = ({ canShow = true, userAccess = null }) => {
    const [notification, setNotification] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userCreatedAtMillis, setUserCreatedAtMillis] = useState(null);

    const location = useLocation();

    // Usamos um ref de Set para rastrear IDs já processados nesta sessão.
    // Isso evita reprocessar o mesmo msgId quando o onSnapshot dispara múltiplas vezes.
    const processedInSession = useRef(new Set());

    const user = auth.currentUser;
    const isHome = location.pathname === '/';
    const isAdmin = userAccess?.permissions?.adminPanel === true;

    const preloadImages = (urls) => {
        if (!urls?.length) return;
        urls.forEach((src) => { const img = new Image(); img.src = src; });
    };

    useEffect(() => {
        if (!user) {
            setUserCreatedAtMillis(null);
            return;
        }

        const authMillis = getAuthCreatedAtMillis(user);
        if (authMillis) {
            setUserCreatedAtMillis(authMillis);
            return;
        }

        let alive = true;
        getDoc(doc(db, 'users', user.uid))
            .then((snap) => {
                if (!alive) return;
                const data = snap.exists() ? snap.data() : {};
                setUserCreatedAtMillis(
                    toMillisSafe(data.createdAt) ||
                    toMillisSafe(data.dataCriacao) ||
                    toMillisSafe(data.created_at) ||
                    null
                );
            })
            .catch(() => {
                if (alive) setUserCreatedAtMillis(null);
            });

        return () => { alive = false; };
    }, [user]);

    useEffect(() => {
        if (!isHome || !user) return;

        const q = query(
            collection(db, 'system_broadcasts'),
            orderBy('timestamp', 'desc'),
            limit(1)
        );

        const unsub = onSnapshot(q, async (snap) => {
            if (snap.empty) return;

            const snapDoc = snap.docs[0];
            const data = snapDoc.data();
            const msgId = snapDoc.id;

            // Já processamos este ID nesta sessão? Para.
            if (processedInSession.current.has(msgId)) return;

            // --- BROADCAST DE TESTE: só admin vê ---
            if (data.targetUid) {
                if (!isAdmin) return;
                // Admin vê broadcasts de teste sem limite (para validar)
                processedInSession.current.add(msgId);
                setNotification({ ...data, id: msgId });
                setCurrentIndex(0);
                if (data.imageUrls?.length) preloadImages(data.imageUrls);
                return;
            }

            // --- BROADCAST SEGMENTADO: admin pode validar, usuário só vê se fizer parte do segmento ---
            if (Array.isArray(data.targetUserIds) && data.targetUserIds.length > 0) {
                const canReceiveSegment = isAdmin || data.targetUserIds.includes(user.uid);
                if (!canReceiveSegment) return;
            }

            // --- BROADCAST INATIVO: ninguém vê ---
            if (data.active === false) return;

            // --- BROADCAST NORMAL: admin + usuários respeitam MAX_VIEWS ---
            const now = new Date();
            const msgTime = data.timestamp?.toDate?.();
            if (!msgTime || now - msgTime >= 24 * 60 * 60 * 1000) return;
            const createdAtMillis = userCreatedAtMillis || getAuthCreatedAtMillis(user);
            if (!isAdmin && createdAtMillis && msgTime.getTime() < createdAtMillis) return;

            // Lê o contador no Firestore
            const readRef = doc(db, 'users', user.uid, 'broadcasts_read', msgId);
            let viewCount = 0;

            try {
                const readSnap = await getDoc(readRef);
                viewCount = readSnap.exists() ? (readSnap.data().viewCount ?? 0) : 0;
            } catch {
                // Se falhar a leitura (ex: permissão), não exibe
                return;
            }

            // Ainda dentro do limite?
            if (viewCount < MAX_VIEWS) {
                // Marca como processado nesta sessão ANTES de exibir
                processedInSession.current.add(msgId);

                // Incrementa o contador no Firestore imediatamente
                try {
                    await setDoc(readRef, {
                        viewCount: viewCount + 1,
                        lastSeenAt: new Date(),
                        msgId,
                    });
                } catch {
                    // Se não conseguir salvar, não exibe para evitar loop
                    return;
                }

                setNotification({ ...data, id: msgId });
                setCurrentIndex(0);
                if (data.imageUrls?.length) preloadImages(data.imageUrls);
            }
        });

        return () => unsub();
    }, [isHome, user, isAdmin, userCreatedAtMillis]);

    useEffect(() => {
        if (notification && canShow && !isVisible) {
            const timer = setTimeout(() => setIsVisible(true), 100);
            return () => clearTimeout(timer);
        } else if (!notification) {
            setIsVisible(false);
        }
    }, [notification, canShow]);

    const handleClose = () => {
        if (!notification) return;
        setIsVisible(false);
        setTimeout(() => {
            setNotification(null);
            setCurrentIndex(0);
        }, 500);
    };

    if (!isHome || !user || !notification) return null;

    // --- MODO 1: CARROSSEL DE IMAGENS ---
    const images = notification.imageUrls || (notification.imageUrl ? [notification.imageUrl] : []);

    if (images.length > 0) {
        const nextSlide = (e) => { e?.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % images.length); };
        const prevSlide = (e) => { e?.stopPropagation(); setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1)); };

        return (
            <AnimatePresence>
                {isVisible && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all cursor-default"
                        />

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full max-w-7xl justify-center h-full pointer-events-none">

                            {images.length > 1 && (
                                <button onClick={prevSlide} className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10 hover:scale-110 shadow-xl shrink-0">
                                    <ChevronLeft size={24} />
                                </button>
                            )}

                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ type: "spring", duration: 0.4 }}
                                className="relative pointer-events-auto flex flex-col items-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button onClick={handleClose} className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full backdrop-blur-md border border-white/10 transition-all z-50 shadow-lg" title="Fechar">
                                    <X size={18} />
                                </button>

                                <div className="relative flex items-center justify-center min-h-[50vh] md:min-h-[60vh] min-w-[300px] w-auto">
                                    <motion.img
                                        key={currentIndex}
                                        src={images[currentIndex]}
                                        alt={`Slide ${currentIndex}`}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                                        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
                                        onDragEnd={(e, { offset, velocity }) => {
                                            const swipe = Math.abs(offset.x) * velocity.x;
                                            if (swipe < -200) nextSlide();
                                            else if (swipe > 200) prevSlide();
                                        }}
                                        className="relative z-10 w-auto h-auto max-w-[95vw] md:max-w-[80vw] max-h-[70vh] md:max-h-[85vh] object-contain block cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden shadow-2xl border border-zinc-800"
                                    />

                                    {images.length > 1 && (
                                        <div className="absolute bottom-4 left-0 w-full hidden md:flex justify-center gap-2 z-20 pointer-events-none">
                                            {images.map((_, idx) => (
                                                <div key={idx} className={`h-1.5 rounded-full transition-all shadow-sm ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/40 w-1.5'}`} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {images.length > 1 && (
                                    <div className="flex md:hidden items-center justify-between w-full mt-4 px-4">
                                        <button onClick={(e) => { e.stopPropagation(); prevSlide(); }} className="p-3 bg-white/10 text-white rounded-full active:bg-white/20 border border-white/5">
                                            <ChevronLeft size={24} />
                                        </button>
                                        <div className="flex gap-1.5">
                                            {images.map((_, idx) => (
                                                <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-5' : 'bg-white/20 w-1.5'}`} />
                                            ))}
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); nextSlide(); }} className="p-3 bg-white/10 text-white rounded-full active:bg-white/20 border border-white/5">
                                            <ChevronRight size={24} />
                                        </button>
                                    </div>
                                )}
                            </motion.div>

                            {images.length > 1 && (
                                <button onClick={nextSlide} className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10 hover:scale-110 shadow-xl shrink-0">
                                    <ChevronRight size={24} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    // --- MODO 2: TEXTO ---
    const getTheme = (type) => {
        const redThemeBase = {
            bgClass: 'bg-gradient-to-br from-red-50 to-red-100 border-r border-red-100/50',
            titleColor: 'text-red-700',
            iconColor: 'text-red-600',
            barColor: 'bg-red-600',
            button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
        };
        const styles = {
            atualizacao: { ...redThemeBase, title: 'ATUALIZAÇÃO', icon: Zap },
            urgente:     { ...redThemeBase, title: 'URGENTE',     icon: Bell },
            aviso:       { ...redThemeBase, title: 'ATENÇÃO',     icon: AlertTriangle },
            comunicado:  { ...redThemeBase, title: 'COMUNICADO',  icon: Megaphone }
        };
        return styles[type] || styles.comunicado;
    };

    const theme = getTheme(notification.category);
    const Icon = theme.icon;
    const isLongText = notification.message && notification.message.length > 150;

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ef4444; border-radius: 10px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
                    `}</style>

                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all cursor-default"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 50 }}
                        transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
                        className={`
                            relative w-full overflow-hidden bg-white
                            rounded-3xl shadow-2xl border border-zinc-200
                            flex flex-col md:flex-row
                            max-h-[85vh] md:max-h-auto
                            ${isLongText ? 'max-w-4xl' : 'max-w-[360px] md:max-w-2xl'}
                        `}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Lado Esquerdo */}
                        <div className={`relative overflow-hidden flex flex-col items-center justify-center shrink-0 w-full md:w-5/12 py-10 md:py-0 md:min-h-[300px] ${theme.bgClass}`}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none mix-blend-multiply">
                                <img src="/logoModoQAP.png" alt="Watermark" className="w-[140%] h-[140%] object-contain scale-150 grayscale" />
                            </div>
                            <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 }} className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 flex items-center justify-center shadow-lg mb-3 md:mb-4">
                                <Icon size={32} className={`${theme.iconColor} drop-shadow-sm md:w-10 md:h-10`} />
                            </motion.div>
                            <div className="relative z-10 text-center px-4">
                                <h2 className={`text-xl md:text-3xl font-black ${theme.titleColor} uppercase tracking-widest drop-shadow-sm font-sans`}>{theme.title}</h2>
                                <div className={`h-1 w-12 ${theme.barColor} mx-auto mt-2 rounded-full opacity-50`}></div>
                            </div>
                        </div>

                        {/* Lado Direito */}
                        <div className="flex flex-col relative bg-white overflow-hidden w-full md:w-7/12">
                            <button onClick={handleClose} className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors z-20 rounded-full">
                                <X size={18} />
                            </button>
                            <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
                                <div className="flex items-center gap-2 mb-4 shrink-0">
                                    <div className={`w-1 h-6 rounded-full ${theme.barColor}`}></div>
                                    <h3 className={`text-lg font-bold ${theme.titleColor} uppercase tracking-tight`}>{theme.title}</h3>
                                </div>
                                <div className="prose prose-sm prose-zinc max-w-none">
                                    <p className="text-sm md:text-base text-zinc-600 whitespace-pre-wrap font-medium leading-relaxed">{notification.message}</p>
                                </div>
                            </div>
                            <div className="p-4 md:p-5 pt-2 mt-auto border-t border-zinc-100 bg-zinc-50 shrink-0 flex flex-col items-center justify-center">
                                <button onClick={handleClose} className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2 mb-3 ${theme.button}`}>
                                    <Check size={14} strokeWidth={3} /> Ciente
                                </button>
                                <div className="flex items-center justify-center gap-2 opacity-40">
                                    <img src="/logoModoQAP.png" alt="Logo Sistema" className="h-4 w-auto object-contain grayscale" />
                                    <div className="h-3 w-px bg-zinc-300"></div>
                                    <h1 className="text-red-600 font-black tracking-widest uppercase text-[9px]">MODOQAP</h1>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default BroadcastReceiver;
