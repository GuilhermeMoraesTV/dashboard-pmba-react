import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Wallet, Calendar, CalendarDays, ChevronRight, BadgeCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';
// Pré-busca silenciosa — inicia o fetch do artigo quando o usuário passa o mouse
import { artigoCache } from '../../services/noticiaIA';
import { fetchViaProxy } from '../../hooks/useNoticias';

// ─── LOGO ESTRATÉGIA (com fallback) ──────────────────────────────────────────
function LogoComFallback({ size = 'sm' }) {
  const [erro, setErro] = useState(false);
  const sz = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4';
  const szFallback = size === 'lg' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-6 h-6 text-[10px]' : 'w-4 h-4 text-[7px]';

  if (erro) {
    return (
      <div className={`${szFallback} rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <span className="text-white font-black">E</span>
      </div>
    );
  }
  return (
    <img
      src="/logo-estrategia.png"
      alt="Estratégia"
      className={`${sz} rounded object-contain flex-shrink-0`}
      onError={() => setErro(true)}
    />
  );
}

// Cache local de URLs já iniciadas para não duplicar fetches
const _prefetchEmAndamento = new Set();

export default function NoticiaCard({ noticia, index = 0, onClick }) {
  const ia     = noticia.ia || {};

  // Pré-busca: ao passar o mouse, inicia o fetch do HTML do artigo em background.
  // Quando o usuário clicar, o proxy já terá respondido e o Gemini começa mais cedo.
  const handleMouseEnter = useCallback(() => {
    const link = noticia.link;
    if (!link) return;
    // Não repete se já está em cache de memória ou já foi iniciado
    if (artigoCache.has(link)) return;
    if (_prefetchEmAndamento.has(link)) return;
    _prefetchEmAndamento.add(link);
    // Fetch silencioso — erros são ignorados, é apenas otimização
    fetchViaProxy(link).catch(() => {});
  }, [noticia.link]);
  const titulo = ia.titulo_inteligente || ia.titulo_limpo || noticia.titulo || 'Concurso';
  const status = ia.status || '';
  const banca  = ia.banca  || ia.quadro?.banca  || '';
  const vagas  = ia.vagas  || ia.quadro?.vagas  || '';
  const salario = ia.salario_maximo || ia.quadro?.salario || '';
  const inscricao = ia.quadro?.inscricao || '';
  const prova     = ia.quadro?.prova     || '';

  const campos = [
    banca     && { icon: Building2,    label: 'Banca',      valor: banca,    cor: 'text-zinc-400' },
    inscricao && { icon: Calendar,     label: 'Inscrições', valor: inscricao, cor: 'text-violet-400' },
    prova     && { icon: CalendarDays, label: 'Prova',      valor: prova,    cor: 'text-orange-400' },
    vagas     && { icon: Users,        label: 'Vagas',      valor: vagas,    cor: 'text-zinc-400' },
    salario   && { icon: Wallet,       label: 'Salário',    valor: salario,  cor: 'text-red-500', destaque: true },
  ].filter(Boolean);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onClick?.(noticia)}
      onMouseEnter={handleMouseEnter}
      className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-lg hover:shadow-red-600/5 transition-all duration-200 cursor-pointer"
    >
      {/* Header: status + data */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        {status
          ? <StatusBadge status={status} />
          : (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-zinc-400 uppercase tracking-wide">
              <BadgeCheck size={11} className="text-zinc-300" /> Notícia
            </span>
          )
        }
        {noticia.dataRelativa && (
          <span className="text-[9px] text-zinc-400 font-medium">{noticia.dataRelativa}</span>
        )}
      </div>

      {/* Título */}
      <div className="px-4 pb-3">
        <h3 className="font-black text-sm text-zinc-900 dark:text-white leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
          {titulo}
        </h3>
      </div>

      {/* Campos de dados */}
      {campos.length > 0 && (
        <div className="flex-1 px-4 pb-3 space-y-1.5 border-t border-zinc-50 dark:border-zinc-800/60 pt-3">
          {campos.map((f, fi) => (
            <div key={fi} className="flex items-center gap-2">
              <f.icon size={11} className={`${f.cor} flex-shrink-0`} />
              <span className="text-[9px] text-zinc-400 font-semibold w-[52px] flex-shrink-0">{f.label}</span>
              <span className={`text-[11px] leading-tight truncate ${f.destaque ? 'text-red-600 dark:text-red-400 font-black' : 'text-zinc-700 dark:text-zinc-300 font-medium'}`}>
                {f.valor}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-50 dark:border-zinc-800 mt-auto">
        <div className="flex items-center gap-1.5">
          <LogoComFallback />
          <span className="text-[9px] text-zinc-400">Estratégia Concursos</span>
        </div>
        <span className="text-[9px] text-red-500 dark:text-red-400 font-bold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          Ver detalhes <ChevronRight size={10} />
        </span>
      </div>
    </motion.article>
  );
}




