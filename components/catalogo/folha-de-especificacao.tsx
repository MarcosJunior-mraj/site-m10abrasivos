import { comInicialMaiuscula, rotuloDeAplicacao, rotuloDePedra } from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";
import { chaveFalaDePreco, textoFalaDePreco } from "@/lib/catalog/sem-preco";

type Linha = { rotulo: string; valor: string };

function linhas(item: ItemCatalogo): Linha[] {
  const lista: Linha[] = [];
  if (item.grit) lista.push({ rotulo: "Grana", valor: `#${item.grit}` });
  if (item.diameterMm) lista.push({ rotulo: "Diâmetro", valor: `${item.diameterMm} mm` });
  if (item.stones.length > 0) {
    lista.push({
      rotulo: "Pedras",
      valor: item.stones.map((pedra) => comInicialMaiuscula(rotuloDePedra(pedra))).join(", "),
    });
  }
  if (item.applications.length > 0) {
    lista.push({
      rotulo: "Aplicações",
      valor: item.applications.map((uso) => comInicialMaiuscula(rotuloDeAplicacao(uso))).join(", "),
    });
  }
  if (item.machines.length > 0) lista.push({ rotulo: "Máquinas", valor: item.machines.join(", ") });
  for (const [chave, valor] of Object.entries(item.specs)) {
    if (typeof valor !== "string" && typeof valor !== "number") continue;
    const texto = String(valor);
    // Spec é chave/valor livre digitado no CRM: par que fala de preço não
    // vai para a tela (ver lib/catalog/sem-preco.ts).
    if (chaveFalaDePreco(chave) || textoFalaDePreco(texto)) continue;
    lista.push({ rotulo: chave, valor: texto });
  }
  return lista;
}

export function FolhaDeEspecificacao({ item }: { item: ItemCatalogo }) {
  const dados = linhas(item);
  if (dados.length === 0) return null;

  return (
    <section aria-labelledby="ficha" className="rounded-tecnico border border-borda bg-superficie">
      <h2 id="ficha" className="border-b border-borda px-5 py-3 text-sm">
        Folha de especificação
      </h2>
      <dl className="divide-y divide-borda">
        {dados.map((linha) => (
          <div key={linha.rotulo} className="flex gap-4 px-5 py-3">
            <dt className="w-32 shrink-0 text-xs uppercase tracking-wider text-texto-secundario">
              {linha.rotulo}
            </dt>
            <dd className="font-mono text-sm">{linha.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
