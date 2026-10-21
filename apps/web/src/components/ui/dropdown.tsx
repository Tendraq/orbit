"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// A small pop-up menu. Closes when you click outside or press Escape.
export function Dropdown({
  trigger, children, align = "right", width = "w-64", triggerClassName, label,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
  triggerClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "animate-fade-up absolute z-50 mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift",
            align === "right" ? "right-0" : "left-0",
            width
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const itemClass = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100";

export function MenuItem({
  href, onClick, children, hint, external,
}: { href?: string; onClick?: () => void; children: React.ReactNode; hint?: string; external?: boolean }) {
  const inner = (
    <>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </>
  );
  if (href && external) return <a role="menuitem" href={href} onClick={onClick} className={itemClass}>{inner}</a>;
  if (href) return <Link role="menuitem" href={href} onClick={onClick} className={itemClass}>{inner}</Link>;
  return <button role="menuitem" type="button" onClick={onClick} className={itemClass}>{inner}</button>;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>;
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-slate-100" />;
}
