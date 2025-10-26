// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from 'next/font/google'; // Import 'Inter'
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

// Initialize the font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SiniSpace",
  description: "Dual-KI Oberfläche",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      {/* Add the font class to the body */}
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}