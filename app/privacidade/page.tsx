import type { Metadata } from "next";
import { lerConfigServidor } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a M10 Abrasivos trata os dados de quem fala com a gente pelo site.",
  alternates: { canonical: "/privacidade" },
};

export default function Privacidade() {
  const { empresa } = lerConfigServidor();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl">Política de privacidade</h1>
      <div className="mt-8 flex flex-col gap-6 text-texto-secundario">
        <section>
          <h2 className="text-lg text-texto">Quem trata os seus dados</h2>
          <p>
            {empresa.razaoSocial}, CNPJ {empresa.cnpj}, é a controladora dos dados tratados neste
            site. Dúvidas e pedidos sobre os seus dados: {empresa.emailEncarregado}.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-texto">O que tratamos e por quê</h2>
          <p>
            <strong className="text-texto">
              A conversa do chat é registrada e pode ser lida pela nossa equipe de vendas.
            </strong>{" "}
            Guardamos o que você escreve, a página em que a conversa começou e, quando você informa,
            o seu nome e o seu WhatsApp. Usamos isso só para atender, indicar o produto certo e
            montar o seu pedido.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-texto">Com quem compartilhamos</h2>
          <p>
            Com o nosso próprio sistema de atendimento, onde a conversa fica registrada, e com o
            provedor do modelo de inteligência artificial que gera as respostas do especialista. Não
            vendemos nem cedemos os seus dados para terceiros.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-texto">Por quanto tempo</h2>
          <p>
            Mantemos o histórico enquanto durar o relacionamento comercial e pelo prazo que a lei
            exigir. Depois disso, apagamos ou anonimizamos.
          </p>
        </section>
        <section>
          <h2 className="text-lg text-texto">Os seus direitos</h2>
          <p>
            Você pode pedir acesso, correção, portabilidade, anonimização ou exclusão dos seus
            dados, e também retirar o consentimento. É só escrever para {empresa.emailEncarregado} —
            respondemos no prazo da LGPD.
          </p>
        </section>
      </div>
    </main>
  );
}
