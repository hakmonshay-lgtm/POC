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
          <div className="border-b border-zinc-800 bg-black">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-3 text-white">
                  <div className="leading-none">
                    <div className="text-2xl font-extrabold tracking-tight">cricket</div>
                    <div className="-mt-1 text-sm font-semibold tracking-tight text-white/90">wireless</div>
                  </div>
                </Link>
                <div className="hidden items-center gap-3 md:flex">
                  <div className="text-sm text-white/90">
                    <span className="font-semibold text-white">Welcome,</span> {session.userId}
                  </div>
                  <span className="rounded-full bg-[var(--cw-green)] px-3 py-1 text-xs font-semibold text-white uppercase tracking-wide">
                    {session.role}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-white/90">
                <div className="hidden items-center gap-4 md:flex">
                  <div className="font-semibold text-white">Promotion</div>
                  <div className="h-5 w-px bg-white/30" />
                  <nav className="flex items-center gap-4">
                    <Link className="hover:text-white" href="/nbas">
                      Next Best Action
                    </Link>
                    <Link className="hover:text-white" href="/analytics">
                      Analytics
                    </Link>
                    <Link className="hover:text-white" href="/legal">
                      Legal
                    </Link>
                  </nav>
                </div>
                <RoleSwitcher initialRole={session.role} initialUserId={session.userId} />
                <button type="button" className="text-white/80 hover:text-white">
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
