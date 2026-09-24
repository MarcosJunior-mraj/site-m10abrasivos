/**
 * Onde o `ClienteWebchat` guarda o token da sessão (localStorage), por canal.
 * Módulo leve de propósito: o balão proativo consulta a chave sem importar o
 * cliente do webchat (que fica fora da carga inicial da página).
 */
export function chaveDaSessaoGuardada(chaveDoCanal: string): string {
  return `webchat_token_${chaveDoCanal}`;
}

/** Há uma conversa salva deste canal? Armazenamento bloqueado conta como "não". */
export function temSessaoGuardada(chaveDoCanal: string): boolean {
  try {
    return Boolean(localStorage.getItem(chaveDaSessaoGuardada(chaveDoCanal)));
  } catch {
    return false;
  }
}
