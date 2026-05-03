import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Activity, FileCheck2, BookOpen, LogOut, User, Copy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pazienti", label: "Pazienti", icon: Users },
  { to: "/criteri", label: "Criteri", icon: FileCheck2 },
  { to: "/linee-guida", label: "Linee Guida", icon: BookOpen },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const copyInvite = () => {
    if (user?.invite_code) {
      navigator.clipboard.writeText(user.invite_code);
      toast.success("Codice invito copiato");
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen border-r border-gray-200 bg-[#F9FAFB] hidden md:flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0A2540] flex items-center justify-center rounded-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-heading font-black text-lg leading-none tracking-tight">CLINIMETRIA</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">Reumatologia</div>
              </div>
            </div>
          </div>

          {user && (
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">UO</div>
              <div className="text-sm font-medium text-[#0A2540] truncate" title={user.organization_name}>
                {user.organization_name || "—"}
              </div>
              {user.invite_code && (
                <button
                  onClick={copyInvite}
                  className="mt-1 text-xs text-gray-500 hover:text-[#0A2540] flex items-center gap-1"
                  data-testid="copy-invite-code"
                >
                  <Copy className="w-3 h-3" /> Codice: <span className="font-mono">{user.invite_code}</span>
                </button>
              )}
            </div>
          )}

          <nav className="flex-1 p-3 space-y-1">
            {nav.map((item) => {
              const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#0A2540] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="p-3 border-t border-gray-200">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2" data-testid="user-menu-btn">
                    <div className="w-8 h-8 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-xs font-bold">
                      {(user.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">{user.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user.role === "admin" ? "Admin" : "Membro"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" /> Esci
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-screen fade-in">
          {/* Mobile header */}
          <div className="md:hidden border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#0A2540] flex items-center justify-center rounded-sm">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="font-heading font-black tracking-tight">CLINIMETRIA</div>
            </div>
            {user && (
              <Button variant="ghost" size="icon" onClick={logout} data-testid="mobile-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="p-6 md:p-8 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
