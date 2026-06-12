import React from 'react';

const particles = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: `${2 + ((index * 17) % 96)}%`,
  top: `${2 + ((index * 31) % 96)}%`,
  size: `${2 + (index % 4)}px`,
  opacity: 0.14 + (index % 5) * 0.035,
  delay: `${-(index % 12) * 0.55}s`,
  duration: `${10 + (index % 8)}s`,
  driftX: `${index % 2 === 0 ? 14 : -14}px`,
  driftY: `${index % 3 === 0 ? -30 : -20}px`,
}));

export default function AppBackgroundEffects() {
  return (
    <div className="app-background-effects pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      <div className="app-background-effects__wash" />
      <div className="app-background-effects__grid" />
      <div className="app-background-effects__beam" />
      <div className="app-background-effects__halo app-background-effects__halo--left" />
      <div className="app-background-effects__halo app-background-effects__halo--right" />

      {particles.map((particle) => (
        <span
          key={particle.id}
          className="app-background-effects__particle"
          style={{
            '--particle-left': particle.left,
            '--particle-top': particle.top,
            '--particle-size': particle.size,
            '--particle-opacity': particle.opacity,
            '--particle-delay': particle.delay,
            '--particle-duration': particle.duration,
            '--particle-drift-x': particle.driftX,
            '--particle-drift-y': particle.driftY,
          }}
        />
      ))}
    </div>
  );
}
