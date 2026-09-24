const PAUSA_MINIMA_MS = 400;
const PAUSA_POR_CARACTERE_MS = 12.5;
const PAUSA_MAXIMA_MS = 2500;

/** Pausa proporcional ao texto: três mensagens seguidas não caem de uma vez na tela. */
export function pausaParaTexto(texto: string): number {
  const bruto = PAUSA_MINIMA_MS + texto.length * PAUSA_POR_CARACTERE_MS;
  return Math.min(PAUSA_MAXIMA_MS, Math.round(bruto));
}

export class FilaDeExibicao {
  private pendentes: string[] = [];
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  /** Segura a próxima bolha mesmo quando a fila esvazia entre uma e outra. */
  private ocupada = false;

  constructor(private readonly mostrar: (texto: string) => void) {}

  enfileirar(texto: string): void {
    this.pendentes.push(texto);
    if (!this.ocupada) this.despachar();
  }

  private despachar(): void {
    const texto = this.pendentes.shift();
    if (texto === undefined) {
      this.ocupada = false;
      this.temporizador = null;
      return;
    }
    this.mostrar(texto);
    this.ocupada = true;
    // A pausa vem DEPOIS de mostrar e é proporcional ao texto que acabou de
    // entrar na tela: é o tempo de ler antes da próxima bolha.
    this.temporizador = setTimeout(() => this.despachar(), pausaParaTexto(texto));
  }

  /** Solta tudo agora — usado com `prefers-reduced-motion` e ao fechar o painel. */
  esvaziarAgora(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.ocupada = false;
    const restantes = this.pendentes;
    this.pendentes = [];
    for (const texto of restantes) this.mostrar(texto);
  }
}
