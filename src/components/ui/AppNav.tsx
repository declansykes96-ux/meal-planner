"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatelyLogo } from "@/components/ui/PlatelyLogo";

const links = [
  { href: "/planner", label: "Planner" },
  { href: "/meals", label: "Meal Library" },
  { href: "/preferences", label: "Preferences" },
];

export function AppNav() {
  const pathname = usePathname();
  const onPlanner = pathname === "/planner" || pathname.startsWith("/planner/");

  return (
    <header className="border-b border-border/80 bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-6 sm:py-3.5">
        <div className="hidden sm:block" aria-hidden />

        <Link
          href="/planner"
          className="group mx-auto flex items-center gap-2.5 font-[family-name:var(--font-display)] text-foreground transition-opacity hover:opacity-90"
          aria-label="Plately home"
        >
          <span className="relative inline-flex shrink-0 drop-shadow-sm transition-transform duration-500 ease-out group-hover:rotate-[28deg]">
            <PlatelyLogo size={38} animated />
          </span>
          <span className="text-2xl tracking-tight sm:text-[1.65rem]">
            <span className="text-accent">Plate</span>
            <span className="text-foreground">ly</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const isPlanner = link.href === "/planner";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : isPlanner && !onPlanner
                      ? "bg-accent font-medium text-white hover:bg-accent-hover"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {isPlanner && !onPlanner ? "← Planner" : link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
