import { JetBrains_Mono, Montserrat, Poppins } from "next/font/google";

export const fonteTitulo = Poppins({
  weight: ["800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-titulo",
});

export const fonteTexto = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-texto",
});

export const fonteMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-mono",
});
