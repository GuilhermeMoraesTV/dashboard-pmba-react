import React from 'react';

export default function HomeCardTitle({
  icon: Icon,
  eyebrow,
  className = '',
  iconClassName = 'from-red-600 to-rose-700 shadow-red-500/20',
  pingClassName = 'bg-red-500/20',
  titleClassName = 'text-zinc-900 dark:text-white',
  children,
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2.5 ${className}`}>
      {Icon && (
        <div className="relative shrink-0">
          <div className={`absolute inset-0 animate-ping rounded-full opacity-35 duration-[3s] ${pingClassName}`} />
          <div className={`relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${iconClassName}`}>
            <Icon size={16} strokeWidth={1.9} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        {eyebrow && (
          <h3 className={`truncate text-sm font-black uppercase leading-none tracking-tight transition-colors group-hover:text-red-600 dark:group-hover:text-red-400 md:text-base ${titleClassName}`}>
            {eyebrow}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
