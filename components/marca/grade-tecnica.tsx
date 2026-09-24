export function GradeTecnica({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`grade-tecnica pointer-events-none absolute inset-0 ${className}`}
    />
  );
}
