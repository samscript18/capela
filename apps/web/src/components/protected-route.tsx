"use client";

import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { AuthLoadingGate } from "./auth-loading-gate";
import { PremiumBackground } from "./premium-background";
import { useCapelaAuth } from "./providers";
import { Button } from "./ui/button";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { ready, authenticated, configured, login } = useCapelaAuth();
  if (!ready) return <AuthLoadingGate />;
  if (authenticated) return children;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <PremiumBackground />
      <section className="premium-surface relative z-10 w-full max-w-md p-8 text-center sm:p-10">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-[#9fad7c]/20 bg-[#9fad7c]/[.07] text-[#9fad7c]">
          <LockKeyhole size={19} />
        </span>
        <span className="eyebrow mt-7">Protected workspace</span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-.04em]">Sign in to open Capela.</h1>
        <p className="mt-4 text-sm leading-6 text-[#a9b0a4]">
          Your investigations, profile, and embedded wallet stay connected to your verified Privy identity.
        </p>
        <Button onClick={login} disabled={!configured} className="mt-7 w-full">
          {configured ? "Continue with Privy" : "Privy configuration required"}
        </Button>
        {!configured && (
          <p className="mono mt-4 text-[10px] leading-5 text-[#788274]">
            Set NEXT_PUBLIC_PRIVY_APP_ID in your local environment.
          </p>
        )}
      </section>
    </main>
  );
}
