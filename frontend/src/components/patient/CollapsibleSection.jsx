import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function CollapsibleSection({ title, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-2 px-1 group"
      >
        <span className="font-heading font-semibold text-xs text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2 group-hover:text-gray-600 transition-colors">
          {title}
          {badge && <span className="font-normal normal-case text-gray-400">{badge}</span>}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
          : <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}
