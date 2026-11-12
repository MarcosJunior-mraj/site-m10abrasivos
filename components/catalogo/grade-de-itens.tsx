import { CartaoItem } from "@/components/catalogo/cartao-item";
import { ordenarPorGrana } from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

/** Itens da linha, do grão mais grosso ao mais fino. Sem filtros (tirados a pedido). */
export function GradeDeItens({ itens }: { itens: ItemCatalogo[] }) {
  const ordenados = ordenarPorGrana(itens);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-sm text-texto-secundario">
        {ordenados.length} {ordenados.length === 1 ? "item" : "itens"}
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((item) => (
          <CartaoItem key={item.slug} item={item} />
        ))}
      </div>
    </div>
  );
}
