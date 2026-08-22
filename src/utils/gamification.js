// A regra vive junto das Cloud Functions e é importada pelo frontend e pelos
// testes. Assim, curva, limites, ligas e recompensas não divergem entre camadas.
export * from '../../functions/gamification/domain.mjs';
