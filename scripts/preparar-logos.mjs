#!/usr/bin/env node
// scripts/preparar-logos.mjs
//
// Gera os logos publicados em `public/` a partir dos originais em
// `assets/marca/`: recorta a margem transparente (trim) e redimensiona para
// o maior tamanho realmente exibido no site (ver `<Logo largura={...}>` em
// components/layout/cabecalho.tsx e components/secoes/hero.tsx), em 2x para
// telas densas (retina). Também grava
// `components/marca/logo-proporcoes.generated.ts` com a largura/altura reais
// do arquivo gerado, para o componente `Logo` calcular a altura pela
// proporção verdadeira em vez de um número solto.
//
// Rodar de novo sempre que um logo novo entrar em `assets/marca/` ou a
// largura máxima exibida mudar:
//   npm run preparar-logos

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const ORIGEM = path.join(RAIZ, "assets", "marca");
const DESTINO = path.join(RAIZ, "public");
const ARQUIVO_PROPORCOES = path.join(
  RAIZ,
  "components",
  "marca",
  "logo-proporcoes.generated.ts",
);

// Fator de densidade de tela (retina) aplicado sobre a maior largura CSS em
// que cada logo aparece hoje no site.
const FATOR_DENSIDADE = 2;

// Um item por arquivo em assets/marca/. `larguraMaxExibidaCss` é a maior
// largura (em px CSS) com que a variante aparece em algum `<Logo largura=…>`
// do site hoje — ajuste aqui se um novo uso pedir uma largura maior.
const LOGOS = [
  { nome: "logo-m10-negativo.png", larguraMaxExibidaCss: 220 },
  { nome: "logo-m10-positivo.png", larguraMaxExibidaCss: 220 },
];

async function prepararLogo({ nome, larguraMaxExibidaCss }) {
  const origem = path.join(ORIGEM, nome);
  const destino = path.join(DESTINO, nome);
  const larguraAlvo = larguraMaxExibidaCss * FATOR_DENSIDADE;

  await sharp(origem)
    .trim()
    .resize({ width: larguraAlvo, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(destino);

  const metadados = await sharp(destino).metadata();
  return { nome, largura: metadados.width, altura: metadados.height };
}

function chaveDaVariante(nomeArquivo) {
  // "logo-m10-negativo.png" -> "negativo"
  return nomeArquivo.replace(/^logo-m10-/, "").replace(/\.png$/, "");
}

async function main() {
  await mkdir(DESTINO, { recursive: true });

  const resultados = [];
  for (const logo of LOGOS) {
    resultados.push(await prepararLogo(logo));
  }

  const entradas = resultados
    .map(
      (r) =>
        `  ${chaveDaVariante(r.nome)}: { largura: ${r.largura}, altura: ${r.altura} },`,
    )
    .join("\n");

  const conteudo = `// Arquivo GERADO por \`scripts/preparar-logos.mjs\` — não editar à mão.
// Largura/altura reais (em pixels) dos arquivos em \`public/logo-m10-*.png\`
// depois do recorte de margem transparente e do redimensionamento. O
// componente \`Logo\` usa isso para calcular a altura a partir da largura
// exibida, batendo exatamente com o arquivo publicado (evita um número de
// proporção solto e o CLS de uma caixa reservada que não bate com a
// imagem).
export const DIMENSOES_LOGO = {
${entradas}
} as const;
`;

  await writeFile(ARQUIVO_PROPORCOES, conteudo, "utf8");

  console.log("Logos gerados em public/:");
  for (const r of resultados) {
    console.log(`  ${r.nome}: ${r.largura}x${r.altura}px`);
  }
  console.log(`Proporções gravadas em ${path.relative(RAIZ, ARQUIVO_PROPORCOES)}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
