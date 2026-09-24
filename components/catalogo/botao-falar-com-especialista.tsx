import type { ItemCatalogo } from "@/lib/catalog/schemas";

/**
 * `data-abrir-chat` é o contrato com o widget (Tarefa 12): ele escuta o clique
 * em qualquer elemento com esse atributo. `data-item` vira o `pageContext.item`
 * que a inbox do CRM mostra no lugar do UUID do visitante.
 */
export function BotaoFalarComEspecialista({ item }: { item: ItemCatalogo }) {
  return (
    <button
      type="button"
      data-abrir-chat=""
      data-item={item.title}
      className="rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
    >
      Falar com especialista
    </button>
  );
}
