import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ensureSeed } from "@/lib/seed";
import { getSessionUser } from "@/lib/auth";
import { Sidebar, Topbar } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function NocLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-9">
          <div className="mx-auto w-full max-w-[1380px]">{children}</div>
        </main>
        <footer className="no-print border-t border-ink-600/30 px-6 py-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-slate-600">
          DTIC/SUPORTE · Central de Operações de Rede · acesso web seguro
        </footer>
      </div>
    </div>
  );
}
