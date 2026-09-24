/** Só aparece em linha `rascunho`: marca onde o material ainda não chegou. */
export function AguardandoMaterial({ oque }: { oque: string }) {
  return (
    <div className="grade-tecnica flex min-h-40 items-center justify-center rounded-tecnico border border-dashed border-laranja p-6 text-center font-mono text-sm text-laranja">
      Aguardando material: {oque}
    </div>
  );
}
