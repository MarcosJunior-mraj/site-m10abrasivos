import { Cota } from "@/components/marca/cota";

const PASSOS = [
  {
    numero: "01",
    titulo: "Escolha o item ou descreva o serviço",
    texto: "Navegue pelo catálogo ou conte qual pedra, máquina e acabamento você precisa.",
  },
  {
    numero: "02",
    titulo: "Fale com o especialista",
    texto: "Você recebe a indicação técnica e o orçamento pelo chat ou pelo WhatsApp.",
  },
  {
    numero: "03",
    titulo: "Receba o pedido pronto",
    texto: "O pedido vai montado para o vendedor, que fecha frete e pagamento com você.",
  },
];

export function ComoFunciona() {
  return (
    <section aria-labelledby="como-funciona" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="como-funciona">Como funciona</h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {PASSOS.map((passo) => (
          <li key={passo.numero} className="flex flex-col gap-3">
            <Cota valor={passo.numero} rotulo="Passo" />
            <h3 className="text-lg">{passo.titulo}</h3>
            <p className="text-sm text-texto-secundario">{passo.texto}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10">
        <button
          type="button"
          data-abrir-chat=""
          className="rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
        >
          Falar com especialista
        </button>
      </div>
    </section>
  );
}
