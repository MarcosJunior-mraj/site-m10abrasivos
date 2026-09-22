"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoLgpd } from "@/components/chat/aviso-lgpd";
import { Painel } from "@/components/chat/painel";
import { resolverTurnstile } from "@/components/chat/turnstile";
import { CONFIG_PUBLICA } from "@/lib/config";
import { ClienteWebchat } from "@/lib/webchat/cliente";
import { FilaDeExibicao } from "@/lib/webchat/fila";
import type { EstadoDoChat } from "@/lib/webchat/tipos";

const CHAVE_LGPD = "m10_lgpd_aceito";
/** Spec 9: sem resposta em 45 s, o visitante recebe contingência e o WhatsApp. */
const ESPERA_MAXIMA_MS = 45_000;
/** Aba escondida por mais que isto: fecha o fluxo e devolve a vaga no CRM. */
const ESPERA_PARA_DESLIGAR_MS = 60_000;
const AVISO_CONTINGENCIA =
  "Nosso especialista está demorando para responder. Se preferir, continue pelo WhatsApp.";

function leu(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/**
 * Ponto único de montagem do chat: botão flutuante, aviso de LGPD e painel.
 * Nenhuma outra página importa nada do chat além do `data-abrir-chat`.
 */
export function Widget() {
  const [aberto, setAberto] = useState(false);
  const [precisaAceitar, setPrecisaAceitar] = useState(false);
  const [estado, setEstado] = useState<EstadoDoChat | null>(null);
  const [visiveis, setVisiveis] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);
  /**
   * Fonte de verdade PRÓPRIA do widget para a contingência de 45 s — nunca
   * escrita dentro de `estado` (que vem do núcleo). O núcleo substitui
   * `estado` inteiro a cada mudança (`aoMudar`), então qualquer coisa que a
   * interface gravasse ali (ex.: um "digitando" chegando depois do timer)
   * apagaria a oferta de WhatsApp sem querer.
   */
  const [contingenciaAtiva, setContingenciaAtiva] = useState(false);

  const clienteRef = useRef<ClienteWebchat | null>(null);
  const enfileiradasRef = useRef(0);
  const itemRef = useRef<string | null>(null);
  const contingenciaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desligarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abertoRef = useRef(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  abertoRef.current = aberto;

  /** Fecha o painel e devolve o foco ao botão flutuante — inclusive quando o fechamento veio do Esc. */
  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
  }, []);

  /** Cria o cliente na PRIMEIRA abertura: quem não usa o chat não paga rede nenhuma. */
  const garantirCliente = useCallback((): ClienteWebchat => {
    if (clienteRef.current) return clienteRef.current;

    const semMovimento =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fila = new FilaDeExibicao(() => setVisiveis((quantas) => quantas + 1));

    const cliente = new ClienteWebchat({
      crmUrl: CONFIG_PUBLICA.crmUrl,
      chave: CONFIG_PUBLICA.webchatKey,
      numeroFallback: CONFIG_PUBLICA.whatsappFallback,
    });

    cliente.aoMudar((novo) => {
      setEstado(novo);
      for (let indice = enfileiradasRef.current; indice < novo.bolhas.length; indice += 1) {
        const bolha = novo.bolhas[indice];
        enfileiradasRef.current = indice + 1;
        if (!bolha) continue;
        if (bolha.de === "cliente" || semMovimento) {
          // A própria mensagem aparece na hora, e o que estava na fila vai
          // junto: sem isso a ordem na tela ficaria trocada.
          fila.esvaziarAgora();
          setVisiveis(enfileiradasRef.current);
        } else {
          fila.enfileirar(bolha.texto);
          if (!abertoRef.current) setNaoLidas((quantas) => quantas + 1);
        }
      }
      // Resposta de verdade do especialista: encerra a contingência (o timer
      // pendente, se houver, e o banner que ele já tiver acendido).
      if (novo.bolhas.at(-1)?.de === "especialista") {
        if (contingenciaRef.current) {
          clearTimeout(contingenciaRef.current);
          contingenciaRef.current = null;
        }
        setContingenciaAtiva(false);
      }
    });

    clienteRef.current = cliente;
    return cliente;
  }, []);

  const iniciar = useCallback(async () => {
    const cliente = garantirCliente();
    const token = await resolverTurnstile(CONFIG_PUBLICA.turnstileSiteKey);
    await cliente.abrir(token);
    cliente.conectar();
  }, [garantirCliente]);

  const abrir = useCallback(
    async (item: string | null) => {
      itemRef.current = item;
      setAberto(true);
      setNaoLidas(0);
      if (!leu(CHAVE_LGPD)) {
        setPrecisaAceitar(true);
        return;
      }
      if (!clienteRef.current) await iniciar();
      else await clienteRef.current.sincronizar();
    },
    [iniciar],
  );

  // Qualquer elemento com `data-abrir-chat` abre o painel — nenhuma página
  // precisa importar o widget.
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;
      const gatilho = alvo.closest<HTMLElement>("[data-abrir-chat]");
      if (!gatilho) return;
      evento.preventDefault();
      void abrir(gatilho.dataset.item ?? null);
    }
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [abrir]);

  // Visitante que volta: a conversa já existe, então o chat religa sozinho (sem
  // abrir o painel) para ele ver o aviso de mensagem nova.
  useEffect(() => {
    if (leu(`webchat_token_${CONFIG_PUBLICA.webchatKey}`) && leu(CHAVE_LGPD)) void iniciar();
  }, [iniciar]);

  // Aba escondida por mais de um minuto: fecha o fluxo. Ao voltar, sincroniza e
  // reconecta. É o que substitui o poll, que estouraria a cota diária.
  useEffect(() => {
    function aoMudarVisibilidade() {
      const cliente = clienteRef.current;
      if (!cliente) return;
      if (document.visibilityState === "hidden") {
        desligarRef.current = setTimeout(() => cliente.desconectar(), ESPERA_PARA_DESLIGAR_MS);
        return;
      }
      if (desligarRef.current) clearTimeout(desligarRef.current);
      desligarRef.current = null;
      void cliente.sincronizar().then(() => cliente.conectar());
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  // Em modo estrito o React monta, desmonta e monta de novo: sem zerar as
  // refs aqui, a remontagem encontraria `clienteRef.current` ainda apontando
  // para o cliente morto e o devolveria sem reassinar `aoMudar` — o chat
  // ficaria mudo pelo resto da sessão, sem erro nenhum.
  useEffect(() => {
    return () => {
      clienteRef.current?.encerrar();
      clienteRef.current = null;
      if (contingenciaRef.current) {
        clearTimeout(contingenciaRef.current);
        contingenciaRef.current = null;
      }
      if (desligarRef.current) {
        clearTimeout(desligarRef.current);
        desligarRef.current = null;
      }
    };
  }, []);

  async function enviar(texto: string) {
    const cliente = garantirCliente();
    await cliente.enviar(texto, { url: location.href, item: itemRef.current });
    if (contingenciaRef.current) clearTimeout(contingenciaRef.current);
    contingenciaRef.current = setTimeout(() => {
      setContingenciaAtiva(true);
    }, ESPERA_MAXIMA_MS);
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        data-testid="botao-chat"
        // Alterna: aberto fecha sem rede nenhuma (a cota é de 200 req/dia por
        // sessão, e um clique de fechar não pode custar uma sincronização).
        onClick={() => (aberto ? fechar() : void abrir(itemRef.current))}
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

      {aberto && precisaAceitar ? (
        <AvisoLgpd
          aoAceitar={() => {
            try {
              localStorage.setItem(CHAVE_LGPD, "1");
            } catch {
              // Navegador sem armazenamento: o aviso volta na próxima visita.
            }
            setPrecisaAceitar(false);
            void iniciar();
          }}
          aoRecusar={fechar}
        />
      ) : null}

      {aberto && !precisaAceitar && estado ? (
        <Painel
          estado={{
            ...estado,
            bolhas: estado.bolhas.slice(0, visiveis),
            // Combinadas só na hora de renderizar: a contingência é estado do
            // widget, nunca escrito dentro do `estado` que veio do núcleo.
            ofereceuWhatsapp: estado.ofereceuWhatsapp || contingenciaAtiva,
            aviso: estado.aviso ?? (contingenciaAtiva ? AVISO_CONTINGENCIA : null),
          }}
          aoEnviar={(texto) => void enviar(texto)}
          aoFechar={fechar}
        />
      ) : null}
    </>
  );
}
