import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Volume2, Upload, Play, Check, Clock,
  RefreshCw, Music, Palette, Coffee, Zap, Sliders, Plus, Minus
} from 'lucide-react';

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#06b6d4', '#ffffff',
];

const DEFAULT_SOUNDS = [
  { id: 'beep', name: 'Beep Simples', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
  { id: 'digital', name: 'Relógio Digital', url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
  { id: 'mechanical', name: 'Relógio Mecânico', url: 'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg' },
  { id: 'bugle', name: 'Toque Militar', url: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg' },
  { id: 'zen', name: 'Gongo Zen', url: 'https://cdn.freesound.org/previews/235/235886_3226359-lq.mp3' },
];

export const useTimerSettings = () => {
  const [settings, setSettings] = useState({
    mode: 'livre',
    pomodoroTime: 50,
    restTime: 10,
    color: '#10B981',
    soundType: 'default',
    selectedSoundId: 'beep',
    customSoundUrl: null,
    soundVolume: 0.5
  });

  useEffect(() => {
    const saved = localStorage.getItem('@ModoQAP:TimerSettings');
    if (saved) {
      try {
        setSettings({ ...settings, ...JSON.parse(saved) });
      } catch (e) { console.error(e); }
    }
  }, []);

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('@ModoQAP:TimerSettings', JSON.stringify(updated));
  };

  return { settings, updateSettings };
};

const TimeAdjuster = ({ label, valueMinutes, onChange, colorClass, icon: Icon, maxVal = 180 }) => {
    // Volta para lógica de números inteiros (minutos)
    const hours = Math.floor(valueMinutes / 60);
    const minutes = valueMinutes % 60;

    const adjust = (amount) => {
        // Mínimo de 5 minutos, máximo definido por maxVal
        const newValue = Math.max(5, Math.min(maxVal, valueMinutes + amount));
        // Garante múltiplos de 5
        const rounded = Math.round(newValue / 5) * 5;
        onChange(rounded);
    };

    return (
        <div className="bg-zinc-100 dark:bg-zinc-950/50 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-white dark:bg-zinc-900 shadow-sm ${colorClass}`}>
                        <Icon size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">{label}</span>
                </div>
                <div className="text-right">
                    <span className="text-lg font-mono font-bold text-zinc-900 dark:text-white leading-none">
                        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:00
                    </span>
                </div>
            </div>

            <div className="relative h-6 mb-4 flex items-center">
                <input
                    type="range"
                    min="5" max={maxVal} step="5"
                    value={valueMinutes}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white z-10"
                />
            </div>

            <div className="flex items-center justify-between gap-3">
                <button onClick={() => adjust(-5)} className="flex-1 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 transition-all text-zinc-500 font-bold text-xs uppercase">
                    <Minus size={14} className="mr-1"/> 5 min
                </button>
                <button onClick={() => adjust(5)} className="flex-1 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 transition-all text-zinc-500 font-bold text-xs uppercase">
                    <Plus size={14} className="mr-1"/> 5 min
                </button>
            </div>
        </div>
    );
};

const TimerSettingsModal = ({ isOpen, onClose, onSave }) => {
  const { settings: initialSettings } = useTimerSettings();
  const [localSettings, setLocalSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState('geral');
  const fileInputRef = useRef(null);
  const audioPreviewRef = useRef(null);

  useEffect(() => {
    if (isOpen) setLocalSettings(initialSettings);
  }, [isOpen, initialSettings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("O arquivo deve ter menos de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings(prev => ({
          ...prev,
          soundType: 'custom',
          customSoundUrl: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const playPreviewSound = (soundUrlOverride = null) => {
    let src = '';
    if (soundUrlOverride) {
      src = soundUrlOverride;
    } else if (localSettings.soundType === 'custom' && localSettings.customSoundUrl) {
      src = localSettings.customSoundUrl;
    } else {
      const sound = DEFAULT_SOUNDS.find(s => s.id === localSettings.selectedSoundId) || DEFAULT_SOUNDS[0];
      src = sound.url;
    }

    if (audioPreviewRef.current && src) {
      audioPreviewRef.current.src = src;
      audioPreviewRef.current.volume = localSettings.soundVolume;
      audioPreviewRef.current.play().catch(e => console.error(e));
    }
  };

  const renderPreview = () => {
    const isPomodoro = localSettings.mode === 'pomodoro';
    const hours = Math.floor(localSettings.pomodoroTime / 60);
    const minutes = localSettings.pomodoroTime % 60;
    const timeDisplay = isPomodoro
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      : "00:00:00";

    return (
      <div className="relative w-full h-48 md:h-56 bg-zinc-900 rounded-3xl flex flex-col items-center justify-center overflow-hidden border border-zinc-800 shadow-2xl mb-6 shrink-0 group">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px', color: localSettings.color }}></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-60 transition-colors duration-500" style={{ color: localSettings.color }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 rounded-full blur-[60px] md:blur-[80px] opacity-20 transition-colors duration-700 pointer-events-none" style={{ backgroundColor: localSettings.color }}></div>

        <div className="relative z-10 mb-3 px-3 py-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300" style={{ backgroundColor: localSettings.color }}></span>
          <span className="text-zinc-300">{isPomodoro ? 'Foco (Pomodoro)' : 'Modo Livre'}</span>
        </div>

        <div className="relative z-10 text-4xl sm:text-6xl font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 drop-shadow-2xl" style={{ color: '#ffffff', textShadow: `0 0 30px ${localSettings.color}80` }}>
          {timeDisplay}
        </div>
        <p className="relative z-10 mt-2 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Pré-visualização</p>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* REMOVIDO O ÍCONE ZAP (RAIO) DE FUNDO AQUI
      */}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-zinc-50 dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] relative z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/20">
                <Sliders size={20} className="text-white"/>
             </div>
             <div>
                <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Configurar Timer</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Personalize sua experiência</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-900">
          {renderPreview()}

          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl mb-6 border border-zinc-200 dark:border-zinc-800 relative">
            {['geral', 'aparencia', 'som'].map(tab => (
               <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide rounded-xl transition-all relative z-10 ${activeTab === tab ? 'bg-white dark:bg-zinc-800 text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
               >
                 {tab === 'geral' && <span className="flex items-center justify-center gap-2"><Clock size={14}/> Modo</span>}
                 {tab === 'aparencia' && <span className="flex items-center justify-center gap-2"><Palette size={14}/> Cores</span>}
                 {tab === 'som' && <span className="flex items-center justify-center gap-2"><Music size={14}/> Sons</span>}
                 {activeTab === tab && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-transparent rounded-xl -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                 )}
               </button>
            ))}
          </div>

          <div className="min-h-[200px]">
            <AnimatePresence mode="wait">
                {activeTab === 'geral' && (
                    <motion.div
                        key="geral"
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                        className="space-y-6"
                    >
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Estilo de Contagem</label>
                        <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setLocalSettings(p => ({...p, mode: 'livre'}))}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all duration-300 ${localSettings.mode === 'livre' ? 'border-red-600 bg-red-50 dark:bg-red-900/10 text-red-600' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                        >
                            <Clock size={24} className={localSettings.mode === 'livre' ? 'text-red-500' : 'opacity-50'}/>
                            <div className="text-center">
                                <span className="block text-sm font-black uppercase">Livre</span>
                                <span className="text-[10px] font-medium opacity-70">Cronômetro</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setLocalSettings(p => ({...p, mode: 'pomodoro'}))}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all duration-300 ${localSettings.mode === 'pomodoro' ? 'border-red-600 bg-red-50 dark:bg-red-900/10 text-red-600' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                        >
                            <RefreshCw size={24} className={localSettings.mode === 'pomodoro' ? 'text-red-500' : 'opacity-50'}/>
                            <div className="text-center">
                                <span className="block text-sm font-black uppercase">Pomodoro</span>
                                <span className="text-[10px] font-medium opacity-70">Temporizador</span>
                            </div>
                        </button>
                        </div>
                    </div>

                    {localSettings.mode === 'pomodoro' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                             <TimeAdjuster
                                label="Tempo de Foco"
                                valueMinutes={localSettings.pomodoroTime}
                                onChange={(val) => setLocalSettings(p => ({...p, pomodoroTime: val}))}
                                colorClass="text-red-500"
                                icon={Zap}
                                maxVal={300}
                             />
                             <TimeAdjuster
                                label="Tempo de Descanso"
                                valueMinutes={localSettings.restTime}
                                onChange={(val) => setLocalSettings(p => ({...p, restTime: val}))}
                                colorClass="text-blue-500"
                                icon={Coffee}
                                maxVal={60}
                             />
                        </motion.div>
                    )}
                    </motion.div>
                )}

                {activeTab === 'aparencia' && (
                    <motion.div
                        key="aparencia"
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                        className="space-y-6"
                    >
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 ml-1">Cor do Efeito Glow</label>
                            <div className="grid grid-cols-4 gap-4">
                            {PRESET_COLORS.map(color => (
                                <button
                                key={color}
                                onClick={() => setLocalSettings(p => ({...p, color}))}
                                className={`h-12 rounded-2xl relative flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg border border-black/5 dark:border-white/5 ${localSettings.color === color ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900 scale-105' : 'opacity-80 hover:opacity-100'}`}
                                style={{ backgroundColor: color }}
                                >
                                {localSettings.color === color && <Check size={20} className={color === '#ffffff' ? 'text-black' : 'text-white'} strokeWidth={3} />}
                                </button>
                            ))}
                            </div>
                        </div>

                        <div className="relative pt-2">
                             <div className="flex items-center gap-3 p-4 bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group">
                                <div className="w-10 h-10 rounded-xl shadow-lg flex items-center justify-center shrink-0 border border-black/10 dark:border-white/10" style={{backgroundColor: localSettings.color}}>
                                    <Palette size={18} className={localSettings.color === '#ffffff' ? 'text-black' : 'text-white'} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Cor Personalizada</p>
                                    <p className="text-sm font-mono text-zinc-900 dark:text-white mt-0.5">{localSettings.color}</p>
                                </div>
                                <input
                                type="color"
                                value={localSettings.color}
                                onChange={(e) => setLocalSettings(p => ({...p, color: e.target.value}))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                             </div>
                             <p className="text-[10px] text-zinc-500 mt-2 px-1">Clique acima para escolher qualquer cor do espectro.</p>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'som' && (
                    <motion.div
                        key="som"
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                        className="space-y-6"
                    >
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Sons Padrões</label>
                        <div className="grid gap-2">
                            {DEFAULT_SOUNDS.map((sound) => (
                                <button
                                    key={sound.id}
                                    onClick={() => {
                                        setLocalSettings(p => ({...p, soundType: 'default', selectedSoundId: sound.id}));
                                        playPreviewSound(sound.url);
                                    }}
                                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${localSettings.soundType === 'default' && localSettings.selectedSoundId === sound.id ? 'border-red-600 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${localSettings.soundType === 'default' && localSettings.selectedSoundId === sound.id ? 'bg-red-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                            {localSettings.soundType === 'default' && localSettings.selectedSoundId === sound.id ? <Volume2 size={16}/> : <Play size={16}/>}
                                        </div>
                                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-200">{sound.name}</span>
                                    </div>
                                    {localSettings.soundType === 'default' && localSettings.selectedSoundId === sound.id && <Check size={16} className="text-red-600 dark:text-white mr-2"/>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1 block mb-3">Upload Personalizado</label>
                        <div className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all ${localSettings.soundType === 'custom' ? 'border-red-600 bg-red-50 dark:bg-red-900/5' : 'border-zinc-300 dark:border-zinc-800'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-sm font-bold ${localSettings.soundType === 'custom' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                                    {localSettings.customSoundUrl ? 'Arquivo Carregado' : 'Nenhum arquivo'}
                                </span>
                                {localSettings.soundType === 'custom' && <div className="text-[10px] bg-red-600 text-white px-2 py-1 rounded">Selecionado</div>}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Upload size={16} /> Escolher Áudio
                                </button>
                                {localSettings.customSoundUrl && (
                                     <button
                                        onClick={() => {
                                            setLocalSettings(p => ({...p, soundType: 'custom'}));
                                            playPreviewSound(localSettings.customSoundUrl);
                                        }}
                                        className="w-12 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center"
                                     >
                                         <Play size={16}/>
                                     </button>
                                )}
                                <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                            </div>
                             <p className="text-[10px] text-zinc-500 mt-2 text-center">Máx 2MB. Formatos: mp3, wav, ogg.</p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between">
                             <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Volume do Alarme</label>
                             <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">{(localSettings.soundVolume * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.1"
                            value={localSettings.soundVolume}
                            onChange={(e) => setLocalSettings(p => ({...p, soundVolume: Number(e.target.value)}))}
                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                        />
                    </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 rounded-b-3xl">
           <button onClick={onClose} className="px-6 py-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors uppercase tracking-wide">
             Cancelar
           </button>
           <button onClick={handleSave} className="px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 transform active:scale-95">
             <Save size={18} /> Salvar Alterações
           </button>
        </div>

        <audio ref={audioPreviewRef} className="hidden" />
      </motion.div>
    </div>
  );
};

export default TimerSettingsModal;