"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { AuthAction } from "./auth-action";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "./ui/sheet";

const links = [
  { href: "/#product", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/methodology", label: "Methodology" },
  // { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      <div
        className={`pointer-events-auto mx-auto flex h-[68px] max-w-[1180px] items-center justify-between rounded-[1.4rem] border px-3 pl-4 transition-all duration-500 sm:px-4 sm:pl-5 ${
          scrolled || pathname !== "/"
            ? "border-white/[.12] bg-[#0b0f0c]/88 shadow-[0_22px_70px_rgba(0,0,0,.38)] backdrop-blur-2xl"
            : "border-white/[.08] bg-[#0b0f0c]/48 backdrop-blur-xl"
        }`}
      >
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                pathname === link.href
                  ? "bg-[#9fad7c]/10 text-[#c8d1aa]"
                  : "text-[#aeb6aa] hover:bg-white/[.05] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <AuthAction />
          <AuthAction launch />
        </div>
        <Sheet>
          <SheetTrigger
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.035] text-[#c4cbc0] transition hover:border-[#9fad7c]/30 hover:text-white lg:hidden"
          >
            <Menu size={19} />
          </SheetTrigger>
          <SheetContent title="Public navigation">
            <div className="mt-16 grid gap-1">
              <span className="mb-4 text-xs font-semibold text-[#788274]">Explore Capela</span>
              {links.map((link) => (
                <SheetClose key={link.href} asChild>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between rounded-xl border border-transparent px-4 py-3.5 text-base text-[#c4cbc0] transition hover:border-white/[.07] hover:bg-white/[.035] hover:text-white"
                  >
                    {link.label}
                    <span className="mono text-[9px] text-[#596354]">↗</span>
                  </Link>
                </SheetClose>
              ))}
              <div className="mt-6 grid gap-2">
                <AuthAction />
                <AuthAction launch />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
