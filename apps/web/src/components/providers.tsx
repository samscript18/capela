"use client";

import { PrivyProvider, useLogin, usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { base, baseSepolia } from "viem/chains";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  userId?: string;
  email?: string;
  walletAddress?: string;
  authMethods: string[];
  supportsPasswordChange: boolean;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  sendBaseTransaction: (input: { to: `0x${string}`; value: bigint; chainId: number }) => Promise<`0x${string}`>;
};

const unavailableTransaction = async () => {
  throw new Error("Privy wallet is unavailable");
};
const AuthContext = createContext<AuthState>({
  ready: true,
  authenticated: false,
  configured: false,
  authMethods: [],
  supportsPasswordChange: false,
  login: () => undefined,
  logout: async () => undefined,
  getAccessToken: async () => null,
  sendBaseTransaction: unavailableTransaction,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim();
  const defaultChain = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID ?? 84532) === base.id ? base : baseSepolia;

  // This decision must be identical during server rendering and the browser's
  // first render. Privy performs its own client-side session initialization.
  const content = appId ? (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        supportedChains: [base, baseSepolia],
        defaultChain,
        appearance: { theme: "dark", accentColor: "#9FAD7C", logo: undefined },
      }}
    >
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  ) : (
    <AuthContext.Provider
      value={{
        ready: true,
        authenticated: false,
        configured: false,
        authMethods: [],
        supportsPasswordChange: false,
        login: () => undefined,
        logout: async () => undefined,
        getAccessToken: async () => null,
        sendBaseTransaction: unavailableTransaction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { login } = useLogin({
    onComplete: ({ wasAlreadyAuthenticated }) => {
      if (wasAlreadyAuthenticated) return;

      let destination = "/dashboard";
      try {
        const pendingMolecule = sessionStorage.getItem("capela.pendingMolecule")?.trim();
        sessionStorage.removeItem("capela.pendingMolecule");
        if (pendingMolecule) {
          destination = `/dashboard/investigate?molecule=${encodeURIComponent(pendingMolecule)}`;
        }
      } catch {
        // Authentication still completes when browser storage is restricted.
      }
      router.replace(destination);
    },
  });
  const linkedEmail = user?.linkedAccounts.find((account) => account.type === "email");
  const linkedWallet = user?.linkedAccounts.find(
    (account) => account.type === "wallet" && account.chainType === "ethereum",
  );
  const walletAddress = linkedWallet && "address" in linkedWallet ? linkedWallet.address : undefined;
  const authMethods = user?.linkedAccounts.map((account) => account.type) ?? [];
  const value = useMemo<AuthState>(
    () => ({
      ready,
      authenticated,
      configured: true,
      userId: user?.id,
      email: linkedEmail && "address" in linkedEmail ? linkedEmail.address : undefined,
      walletAddress,
      authMethods,
      // Capela currently configures Privy's email OTP, Google, and wallet login methods.
      // None of those creates a Capela-managed password credential.
      supportsPasswordChange: false,
      login,
      logout: async () => {
        try {
          await logout();
        } finally {
          queryClient.clear();
          router.replace("/");
          router.refresh();
        }
      },
      getAccessToken,
      sendBaseTransaction: async (input) =>
        (await sendTransaction(input, walletAddress ? { address: walletAddress } : undefined)).hash,
    }),
    [
      authenticated,
      authMethods,
      getAccessToken,
      linkedEmail,
      login,
      logout,
      queryClient,
      ready,
      router,
      sendTransaction,
      user?.id,
      walletAddress,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useCapelaAuth() {
  return useContext(AuthContext);
}
