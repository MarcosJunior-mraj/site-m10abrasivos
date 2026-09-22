"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoLgpd } from "@/components/chat/aviso-lgpd";
import { Painel } from "@/components/chat/painel";
import { resolverTurnstile } from "@/components/chat/turnstile";
import { CONFIG_PUBLICA } from "@/lib/config-publica";
import { ClienteWebchat } from "@/lib/webchat/cliente";
import { FilaDeExibicao } from "@/lib/webchat/fila";
import type { EstadoDoChat } from "@/lib/webchat/tipos";
import { linkDoWhatsapp } from "@/lib/webchat/whatsapp";

const CHAVE_LGPD = "m10_lgpd_aceito";
/** Spec 9: sem resposta em 45 s, o visitante recebe contingência e o WhatsApp. */
const ESPERA_MAXIMA_MS = 45_000;
/** Aba escondida por mais que isto: fecha o fluxo e devolve a vaga no CRM. */
const ESPERA_PARA_DESLIGAR_MS = 60_000;
const AVISO_CONTINGENCIA =
  "Nosso especialista está demorando para responder. Se preferir, continue pelo WhatsApp.";
const AVISO_FALHA_NA_ABERTURA = "Não consegui abrir o atendimento agora. Continue pelo WhatsApp.";

/**
 * O que o painel mostra antes de o cliente dizer qualquer coisa (Turnstile
 * resolvendo, sessão a caminho): já em "abrindo", com o WhatsApp à mão.
 */
const ESTADO_ABRINDO: EstadoDoChat = {
  fase: "abrindo",
  bolhas: [],
  digitando: false,
  vendedorEntrou: false,
  linkDoWhatsapp: linkDoWhatsapp(CONFIG_PUBLICA.whatsappFallback),
  ofereceuWhatsapp: false,
  aviso: null,
};

function leu(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** Cada clique que abre o painel gera um pedido novo (o `id` muda), mesmo com o mesmo item. */
export type PedidoDeAbertura = { id: number; item: string | null };

export type PropsDoChatCompleto = {
  aberto: boolean;
  pedido: PedidoDeAbertura;
  aoFechar: () => void;
  /** Chegou mensagem do especialista com o painel fechado. */
  aoChegarNaoLida: () => void;
};

/**
 * A parte pesada do chat — aviso de LGPD, painel, Turnstile e o cliente do
 * webchat. Carregada sob demanda pelo `Widget` no primeiro clique (spec
 * 7.4): quem não usa o chat não baixa nada disto. Depois de montada, fica
 * montada (mesmo com o painel fechado) para a conversa seguir viva.
 */
export function ChatCompleto({ aberto, pedido, aoFechar, aoChegarNaoLida }: PropsDoChatCompleto) {
  const [precisaAceitar, setPrecisaAceitar] = useState(false);
  const [estado, setEstado] = useState<EstadoDoChat | null>(null);
  const [visiveis, setVisiveis] = useState(0);
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
  /** Só `true` quando o timer de 60 s de fato desligou o fluxo: é o que autoriza religar ao voltar. */
  const desligadoPorInatividadeRef = useRef(false);
  const abertoRef = useRef(aberto);
  const aoChegarNaoLidaRef = useRef(aoChegarNaoLida);

  abertoRef.current = aberto;
  aoChegarNaoLidaRef.current = aoChegarNaoLida;

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
          if (!abertoRef.current) aoChegarNaoLidaRef.current();
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
    try {
      // O Turnstile já não lança (qualquer falha vira "sem token", e o CRM
      // decide); o `catch` é a última rede para qualquer surpresa daqui até
      // o SSE ligar — o visitante nunca fica num painel sem saída.
      const token = await resolverTurnstile(CONFIG_PUBLICA.turnstileSiteKey);
      await cliente.abrir(token);
      // Desmontado no meio do caminho (ex.: modo estrito): não liga o fluxo de
      // um cliente que ninguém mais escuta.
      if (clienteRef.current !== cliente) return;
      cliente.conectar();
    } catch {
      cliente.cairParaWhatsapp(AVISO_FALHA_NA_ABERTURA);
    }
  }, [garantirCliente]);

  // Cada pedido de abertura vindo do botão (ou de um `data-abrir-chat`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage só a um pedido NOVO (o `id`); o item viaja junto.
  useEffect(() => {
    itemRef.current = pedido.item;
    if (!leu(CHAVE_LGPD)) {
      setPrecisaAceitar(true);
      return;
    }
    if (!clienteRef.current) void iniciar();
    else void clienteRef.current.sincronizar();
  }, [pedido.id, iniciar]);

  // Aba escondida por mais de um minuto: fecha o fluxo. Ao voltar, sincroniza e
  // reconecta — SÓ se o fluxo foi mesmo desligado. Aba escondida por menos
  // que isso só cancela o timer: o SSE seguiu ligado e religar gastaria cota
  // (20 req/min, 200/dia) à toa. É o que substitui o poll.
  useEffect(() => {
    function aoMudarVisibilidade() {
      const cliente = clienteRef.current;
      if (!cliente) return;
      if (document.visibilityState === "hidden") {
        if (desligarRef.current) clearTimeout(desligarRef.current);
        desligarRef.current = setTimeout(() => {
          desligarRef.current = null;
          cliente.desconectar();
          desligadoPorInatividadeRef.current = true;
        }, ESPERA_PARA_DESLIGAR_MS);
        return;
      }
      if (desligarRef.current) clearTimeout(desligarRef.current);
      desligarRef.current = null;
      if (!desligadoPorInatividadeRef.current) return;
      desligadoPorInatividadeRef.current = false;
      // Degradado é definitivo nesta página: o visitante já foi mandado ao WhatsApp.
      if (cliente.estado.fase === "degradado") return;
      void cliente.sincronizar().then(() => {
        if (clienteRef.current !== cliente || cliente.estado.fase === "degradado") return;
        cliente.conectar();
      });
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

  if (!aberto) return null;

  if (precisaAceitar) {
    return (
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
        aoRecusar={aoFechar}
      />
    );
  }

  const atual = estado ?? ESTADO_ABRINDO;

  return (
    <Painel
      estado={{
        ...atual,
        bolhas: atual.bolhas.slice(0, visiveis),
        // Combinadas só na hora de renderizar: a contingência é estado do
        // widget, nunca escrito dentro do `estado` que veio do núcleo.
        ofereceuWhatsapp: atual.ofereceuWhatsapp || contingenciaAtiva,
        aviso: atual.aviso ?? (contingenciaAtiva ? AVISO_CONTINGENCIA : null),
      }}
      aoEnviar={(texto) => void enviar(texto)}
      aoFechar={aoFechar}
    />
  );
}

export default ChatCompleto;
