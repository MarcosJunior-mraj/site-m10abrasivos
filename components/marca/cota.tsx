export function Cota({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-laranja pl-3">
      <span className="font-mono text-lg text-texto">{valor}</span>
      <span className="text-xs uppercase tracking-wider text-texto-secundario">{rotulo}</span>
    </div>
  );
}
