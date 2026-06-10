"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Upload, FileText, ScrollText, LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/process", label: "Process Invoice", icon: Upload },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/logs", label: "Agent Logs", icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-[#0d0d0d] border-r border-white/[0.06]">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Image
          src="/elixir-logo.png"
          alt="Elixir Global"
          width={140}
          height={46}
          className="object-contain brightness-0 invert"
          priority
        />
        <p className="text-[10px] text-violet-400/70 font-medium tracking-widest uppercase mt-2">Agent Sandbox</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              )}
            >
              <Icon className={cn("w-4 h-4", active ? "text-violet-400" : "text-zinc-500")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
