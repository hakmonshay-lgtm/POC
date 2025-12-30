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
        <div className="min-h-screen bg-zinc-50">
          <div className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-6">
                <Link href="/" className="text-sm font-semibold text-zinc-900">
                  NBA Studio
                </Link>
                <nav className="flex items-center gap-4 text-sm text-zinc-700">
                  <Link className="hover:text-zinc-900" href="/nbas">
                    NBAs
                  </Link>
                  <Link className="hover:text-zinc-900" href="/analytics">
                    Analytics
                  </Link>
                  <Link className="hover:text-zinc-900" href="/legal">
                    Legal
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-600">
                  Role: <span className="font-medium text-zinc-900">{session.role}</span>
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
