/**
 * Veios em SVG: leves o bastante para entrar no HTML do hero sem custar LCP.
 * `aria-hidden` porque é decoração — nada aqui carrega informação.
 */
export function Veios({ className = "" }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorativo — aria-hidden já remove o svg da árvore de acessibilidade.
    <svg
      aria-hidden
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-25 ${className}`}
    >
      <defs>
        <linearGradient id="veio" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--cor-texto)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--cor-texto)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--cor-texto)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[
        "M0 140 C 220 90, 380 210, 620 150 S 980 70, 1200 130",
        "M0 300 C 260 250, 420 380, 700 320 S 1020 250, 1200 300",
        "M0 470 C 200 430, 400 520, 660 470 S 1000 410, 1200 460",
      ].map((caminho) => (
        <path key={caminho} d={caminho} fill="none" stroke="url(#veio)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
