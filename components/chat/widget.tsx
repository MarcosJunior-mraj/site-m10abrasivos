"use client";

import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PedidoDeAbertura } from "@/components/chat/chat-completo";
import { PainelProvisorio } from "@/components/chat/painel-provisorio";
import { CONFIG_PUBLICA } from "@/lib/config-publica";
import { registrarEvento } from "@/lib/medicao";
import { linkDoWhatsapp } from "@/lib/webchat/whatsapp";

/**
 * O chat de verdade (aviso de LGPD, painel, Turnstile, cliente do webchat e a
 * validação das respostas) só é baixado no primeiro clique — spec 7.4. Na
 * carga de toda página vão só este botão, a casca do painel e a configuração
 * pública.
 */
const ChatCompleto = lazy(() => import("@/components/chat/chat-completo"));

const LINK_DE_RESERVA = linkDoWhatsapp(CONFIG_PUBLICA.whatsappFallback);

/**
 * Se o código do chat não chegar (rede caiu no meio, deploy novo trocou os
 * arquivos), o visitante ainda vê o painel com o WhatsApp — nunca um clique
 * que não mostra nada.
 */
class SeFalhar extends Component<{ reserva: ReactNode; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError(): { falhou: boolean } {
    return { falhou: true };
  }

  render(): ReactNode {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

/**
 * Ponto único de montagem do chat: botão flutuante e o carregamento sob
 * demanda do resto. Nenhuma outra página importa nada do chat além do
 * `data-abrir-chat`.
 */
export function Widget() {
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState<PedidoDeAbertura | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const itemRef = useRef<string | null>(null);
  const destinoRef = useRef<HTMLElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  /** Fecha o painel e devolve o foco ao botão flutuante — inclusive quando o fechamento veio do Esc. */
  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
  }, []);

  const abrir = useCallback((dados: Omit<PedidoDeAbertura, "id">) => {
    itemRef.current = dados.item;
    destinoRef.current = dados.destino;
    setAberto(true);
    setNaoLidas(0);
    setPedido((anterior) => ({ id: (anterior?.id ?? 0) + 1, ...dados }));
    registrarEvento("chat_aberto", { item: dados.item });
  }, []);

  const contarNaoLida = useCallback(() => setNaoLidas((quantas) => quantas + 1), []);

  // Qualquer elemento com `data-abrir-chat` abre o painel — nenhuma página
  // precisa importar o widget.
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;
      const gatilho = alvo.closest<HTMLElement>("[data-abrir-chat]");
      if (!gatilho) return;
      evento.preventDefault();
      const embutido = gatilho.closest<HTMLElement>("[data-chat-embutido]");
      const destino = embutido?.querySelector<HTMLElement>("[data-chat-alvo]") ?? null;
      abrir({
        item: gatilho.dataset.item ?? null,
        abertura: gatilho.dataset.abertura ?? null,
        mensagem: gatilho.dataset.mensagem ?? null,
        destino,
      });
    }
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [abrir]);

  const provisorio = (falhou: boolean) =>
    aberto ? (
      <PainelProvisorio linkDoWhatsapp={LINK_DE_RESERVA} falhou={falhou} aoFechar={fechar} />
    ) : null;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        data-testid="botao-chat"
        // Alterna: aberto fecha sem rede nenhuma (a cota é de 200 req/dia por
        // sessão, e um clique de fechar não pode custar uma sincronização).
        onClick={() =>
          aberto && !destinoRef.current
            ? fechar()
            : abrir({ item: itemRef.current, abertura: null, mensagem: null, destino: null })
        }
        aria-expanded={aberto}
        className="fixed bottom-4 right-4 z-50 min-h-14 rounded-tecnico bg-laranja px-5 font-semibold text-azul shadow-lg"
      >
        Falar com especialista
        {naoLidas > 0 ? (
          <span className="ml-2 rounded-full bg-azul px-2 py-0.5 text-xs text-laranja">
            {naoLidas}
          </span>
        ) : null}
      </button>

      {/* Só existe depois do primeiro clique; a partir daí fica montado (mesmo
          fechado) para a conversa seguir viva. Quem volta com sessão salva não
          abre sessão, SSE nem Turnstile até clicar. */}
      {pedido ? (
        <SeFalhar reserva={provisorio(true)}>
          <Suspense fallback={provisorio(false)}>
            <ChatCompleto
              aberto={aberto}
              pedido={pedido}
              aoFechar={fechar}
              aoChegarNaoLida={contarNaoLida}
            />
          </Suspense>
        </SeFalhar>
      ) : null}
    </>
  );
}
