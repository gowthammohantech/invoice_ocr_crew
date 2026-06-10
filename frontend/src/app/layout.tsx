import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/layout/AuthGuard";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Elixir Global — Agent Sandbox",
  description: "Invoice OCR Agent powered by CrewAI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </body>
    </html>
  );
}
