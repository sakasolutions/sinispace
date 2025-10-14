import type { Metadata } from "next";
// Geist-Schriftarten wurden durch 'Inter' ersetzt, die von Next.js v14 unterstützt wird.
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

// Initialisierung der Inter-Schriftart mit einem CSS-Variablennamen
const inter = Inter({
  variable: "--font-sans", // Wir definieren eine CSS-Variable für die Hauptschriftart
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sinispace",
  description: "Zugang zu den führenden KI-Modellen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      {/* Die Klassen für Geist Sans und Geist Mono wurden durch die Variable für Inter ersetzt.
        Globale Stile (in globals.css) müssen möglicherweise angepasst werden, 
        um var(--font-sans) anstelle der alten Geist-Variablen zu verwenden.
      */}
      <body
        className={`${inter.variable} antialiased bg-slate-50 text-slate-800`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
