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
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-200">
        <Image
          src="/elixir-logo.png"
          alt="Elixir Global"
          width={140}
          height={46}
          className="object-contain"
          priority
        />
        <p className="text-[10px] text-violet-600 font-semibold tracking-widest uppercase mt-2">
          Agent Sandbox
        </p>
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
                  ? "bg-violet-50 text-violet-700 border border-violet-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  active ? "text-violet-600" : "text-slate-400"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
