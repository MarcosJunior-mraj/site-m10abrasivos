import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda da fronteira servidor × navegador (revisão final, I2): segue só os
 * `import ... from` ESTÁTICOS a partir dos componentes que vão na carga de
 * toda página. `import()` dinâmico fica de fora de propósito — é exatamente
 * o que tira o chat pesado da carga inicial.
 */
const RAIZ = resolve(__dirname, "..");
const EXTENSOES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolver(de: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = join(RAIZ, especificador.slice(2));
  else if (especificador.startsWith(".")) base = resolve(dirname(de), especificador);
  else return null;
  for (const extensao of ["", ...EXTENSOES]) {
    const caminho = base + extensao;
    if (existsSync(caminho) && statSync(caminho).isFile()) return caminho;
  }
  return null;
}

/** Devolve cada módulo alcançado (caminho relativo à raiz, ou o nome do pacote). */
function grafoEstatico(entrada: string): Set<string> {
  const vistos = new Set<string>();
  const pendentes = [join(RAIZ, entrada)];
  const importacao = /^\s*import\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;
  while (pendentes.length > 0) {
    const atual = pendentes.pop();
    if (!atual) break;
    const chave = relative(RAIZ, atual).replace(/\\/g, "/");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const fonte = readFileSync(atual, "utf8");
    for (const [, especificador] of fonte.matchAll(importacao)) {
      if (!especificador) continue;
      const alvo = resolver(atual, especificador);
      if (alvo) pendentes.push(alvo);
      else vistos.add(especificador);
    }
  }
  return vistos;
}

const PROIBIDOS_NA_CARGA_INICIAL = [
  "zod",
  "zod/mini",
  "server-only",
  "lib/config.ts",
  "lib/catalog/client.ts",
  "lib/webchat/cliente.ts",
  "components/chat/painel.tsx",
  "components/chat/aviso-lgpd.tsx",
  "components/chat/turnstile.tsx",
];

describe("fronteira do pacote do navegador", () => {
  for (const entrada of ["components/chat/widget.tsx", "components/layout/rodape.tsx"]) {
    it(`${entrada} não puxa Zod, config de servidor nem o chat pesado na carga inicial`, () => {
      const alcancados = grafoEstatico(entrada);
      for (const proibido of PROIBIDOS_NA_CARGA_INICIAL) {
        expect(alcancados.has(proibido), `${entrada} alcança ${proibido}`).toBe(false);
      }
    });
  }

  it("a configuração de servidor e o cliente do catálogo são marcados server-only", () => {
    for (const arquivo of ["lib/config.ts", "lib/catalog/client.ts"]) {
      expect(readFileSync(join(RAIZ, arquivo), "utf8")).toMatch(/^import "server-only";/m);
    }
  });
});
