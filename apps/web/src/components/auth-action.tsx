"use client";

import { ArrowRight, ArrowUpRight, UserRound } from "lucide-react";
import Link from "next/link";
import { useCapelaAuth } from "./providers";
import { buttonVariants } from "./ui/button";

export function AuthAction({ launch = false }: { launch?: boolean }) {
  const { ready, authenticated, configured, login } = useCapelaAuth();
  if (!ready) return <span className="h-11 w-24 animate-pulse rounded-md bg-white/[.04]" />;
  if (authenticated)
    return launch ? (
      <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>
        Open app <ArrowUpRight size={14} />
      </Link>
    ) : (
      <Link href="/profile" className={buttonVariants({ variant: "ghost" })}>
        Account <UserRound size={14} />
      </Link>
    );
  return (
    <button
      type="button"
      onClick={login}
      disabled={!configured}
      title={configured ? undefined : "Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign in"}
      style={{ fontSize: 13, fontWeight: 600 }}
      className={buttonVariants({ variant: launch ? "primary" : "ghost" })}
    >
      {launch ? (
        <>
          Try Now <ArrowRight size={12} />
        </>
      ) : (
        "Sign in"
      )}
    </button>
  );
}
