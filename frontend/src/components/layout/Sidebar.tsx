"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Upload, FileText, LogOut, ChevronLeft, Bot, Landmark } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const invoiceNavItems = [
  { href: "/dashboard", label: "Dashboard",       icon: LayoutDashboard },
  { href: "/process",   label: "Process Invoice",  icon: Upload },
  { href: "/invoices",  label: "Invoices",          icon: FileText },
];

const bankNavItems = [
  { href: "/bank-reconciliation", label: "Process Statement", icon: Upload },
  { href: "/bank-statements",     label: "Bank Statements",   icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const isBankContext = pathname.startsWith("/bank-");
  const navItems      = isBankContext ? bankNavItems : invoiceNavItems;

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
      <nav className="flex-1 px-3 py-4">
        {/* Back to agents hub */}
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          All Agents
        </Link>

        {/* Agent section label */}
        <div className="flex items-center gap-2 px-3 mb-2">
          <div className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0",
            isBankContext ? "bg-emerald-100" : "bg-violet-100"
          )}>
            {isBankContext
              ? <Landmark className="w-3 h-3 text-emerald-600" />
              : <Bot className="w-3 h-3 text-violet-600" />
            }
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 truncate">
            {isBankContext ? "Bank Reconciliation" : "Invoice OCR Agent"}
          </span>
        </div>

        {/* Module items */}
        <div className="ml-3 pl-3 border-l border-slate-100 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const activeColor = isBankContext ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-violet-50 text-violet-700 border border-violet-200";
            const activeIcon  = isBankContext ? "text-emerald-600" : "text-violet-600";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active ? activeColor : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? activeIcon : "text-slate-400")} />
                {label}
              </Link>
            );
          })}
        </div>
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
