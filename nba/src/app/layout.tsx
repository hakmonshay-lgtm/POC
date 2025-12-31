import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { RoleSwitcher } from "@/components/RoleSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA Studio",
  description: "Next Best Action (NBA) marketing tool MVP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-[var(--background)]">
          <div className="border-b border-zinc-200/60 bg-[var(--cw-green)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                    <span className="text-base leading-none">N</span>
                  </span>
                  <span>NBA Studio</span>
                </Link>
                <nav className="flex items-center gap-4 text-sm text-white/90">
                  <Link className="hover:text-white" href="/nbas">
                    NBAs
                  </Link>
                  <Link className="hover:text-white" href="/analytics">
                    Analytics
                  </Link>
                  <Link className="hover:text-white" href="/legal">
                    Legal
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-white/90">
                  Role: <span className="font-semibold text-white">{session.role}</span>
                </div>
                <RoleSwitcher initialRole={session.role} initialUserId={session.userId} />
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
