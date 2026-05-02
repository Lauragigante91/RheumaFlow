import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Activity, FileCheck2 } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pazienti", label: "Pazienti", icon: Users },
  { to: "/criteri", label: "Criteri", icon: FileCheck2 },
];

export default function Layout({ children }) {
  const location = useLocation();
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

          <div className="p-4 border-t border-gray-200 text-[10px] uppercase tracking-[0.2em] text-gray-500">
            v1.0 · Uso clinico
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-screen fade-in">
          {/* Mobile header */}
          <div className="md:hidden border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <div className="w-7 h-7 bg-[#0A2540] flex items-center justify-center rounded-sm">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="font-heading font-black tracking-tight">CLINIMETRIA</div>
          </div>
          <div className="p-6 md:p-8 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
