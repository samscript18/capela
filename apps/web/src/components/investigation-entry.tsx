"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCapelaAuth } from "./providers";

export function InvestigationEntry() {
  const [molecule, setMolecule] = useState("");
  const { authenticated, configured, login } = useCapelaAuth();
  const router = useRouter();
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = molecule.trim();
    if (!value) return;
    if (authenticated) {
      router.push(`/dashboard/investigate?molecule=${encodeURIComponent(value)}`);
      return;
    }
    try {
      sessionStorage.setItem("capela.pendingMolecule", value);
    } catch {
      /* Authentication can still proceed without browser storage. */
    }
    login();
  }
  return (
    <form
      onSubmit={submit}
      className="group relative mt-10 max-w-2xl rounded-[1.55rem] bg-gradient-to-r from-[#9fad7c]/35 via-white/10 to-[#63e6a1]/35 p-px shadow-[0_28px_90px_rgba(0,0,0,.38)] transition duration-500 focus-within:shadow-[0_30px_100px_rgba(130,190,69,.16)]"
    >
      <div className="flex flex-col gap-2 rounded-[calc(1.4rem-1px)] bg-[#111411]/95 p-2 backdrop-blur-xl sm:flex-row">
        <label htmlFor="molecule" className="sr-only">
          Molecule name
        </label>
        <span className="flex min-w-0 flex-1 items-center px-1">
          <span className="ml-2 grid size-9 shrink-0 place-items-center rounded-full bg-white/[.045] text-[#9fad7c]">
            <Search size={16} />
          </span>
          <input
            id="molecule"
            name="molecule"
            required
            value={molecule}
            onChange={(event) => setMolecule(event.target.value)}
            placeholder="Enter a molecule, e.g. Loliolide"
            className="min-h-14 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#6f786b]"
          />
        </span>
        <button
          disabled={!configured}
          title={configured ? undefined : "Set NEXT_PUBLIC_PRIVY_APP_ID to enable investigations"}
          className="action-sheen inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.05rem] border border-[#b8c493]/45 bg-[#9fad7c] px-6 text-sm font-bold text-[#10140d] shadow-[0_12px_34px_rgba(104,122,78,.16)] transition hover:-translate-y-0.5 hover:bg-[#b4c18f] hover:shadow-[0_16px_40px_rgba(104,122,78,.22)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start full investigation <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
