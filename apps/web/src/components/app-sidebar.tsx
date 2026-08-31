"use client";

import { Bell, FlaskConical, Home, LogOut, Settings, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { appShellStyles as styles } from "@/components/app-shell.styles";
import { Brand } from "@/components/brand";
import { useCapelaAuth } from "@/components/providers";
import { useAccess, useMe } from "@/lib/api";

const navigation = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", icon: Home, label: "Home" },
      { href: "/dashboard/investigate", icon: Sparkles, label: "Try now" },
      {
        href: "/dashboard/investigations",
        icon: FlaskConical,
        label: "My investigations",
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", icon: Bell, label: "Notifications" },
      { href: "/profile", icon: UserRound, label: "Profile" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;
}

function Navigation({ onNavigate, persistenceKey }: { onNavigate?: () => void; persistenceKey?: string }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!persistenceKey || !navigationRef.current) return;
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(persistenceKey);
    } catch {
      return;
    }
    if (!stored) return;
    const frame = window.requestAnimationFrame(() => {
      if (navigationRef.current) {
        navigationRef.current.scrollTop = Number(stored) || 0;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [persistenceKey]);

  return (
    <nav
      aria-label="Workspace navigation"
      className={styles.navigation}
      onScroll={(event) => {
        if (!persistenceKey) return;
        try {
          window.sessionStorage.setItem(persistenceKey, String(event.currentTarget.scrollTop));
        } catch {
          // Navigation remains usable when storage is unavailable.
        }
      }}
      ref={navigationRef}
    >
      {navigation.map((group) => (
        <div className={styles.navGroup} key={group.label}>
          <span className={styles.navLabel}>{group.label}</span>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Account({ mobile = false, onRequestLogout }: { mobile?: boolean; onRequestLogout: () => void }) {
  const { email, walletAddress } = useCapelaAuth();
  const me = useMe();
  const access = useAccess();
  const displayName = me.data?.displayName ?? me.data?.email ?? email ?? "Capela researcher";
  const address = me.data?.primaryWalletAddress ?? walletAddress;
  const accessLabel = access.data?.unlimitedInvestigations
    ? "Free preview"
    : access.data?.freeInvestigationAvailable
      ? `${access.data.freeInvestigationsRemaining} free today`
      : "Research access";
  const secondary = [shortAddress(address), accessLabel].filter(Boolean).join(" · ");
  const avatarUrl = me.data?.avatarUrl?.trim();

  return (
    <div className={mobile ? styles.mobileAccount : styles.account}>
      <div
        aria-label={avatarUrl ? `${displayName}'s profile image` : undefined}
        className={styles.avatar}
        role={avatarUrl ? "img" : undefined}
      >
        {avatarUrl ? <img alt="" src={avatarUrl} /> : displayName.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <strong>{displayName}</strong>
        <span>{secondary}</span>
      </div>
      <button onClick={onRequestLogout} type="button" className="text-xs!">
        {mobile && <LogOut aria-hidden="true" size={16} />}
        Log out
      </button>
    </div>
  );
}

export function AppSidebar({
  mobile = false,
  onNavigate,
  onRequestLogout,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  onRequestLogout: () => void;
}) {
  if (mobile) {
    return (
      <>
        <Navigation onNavigate={onNavigate} />
        <Account mobile onRequestLogout={onRequestLogout} />
      </>
    );
  }

  return (
    <>
      <div className={styles.sidebarHeader}>
        <div className={styles.wordmark}>
          <Brand href="/dashboard" variant="workspace" />
        </div>
        <span>Your molecule investigation space</span>
      </div>
      <div className={styles.sidebarWidget}>
        <span>
          <ShieldCheck aria-hidden="true" size={13} />
          Evidence first
        </span>
        <strong>Retrieval before synthesis</strong>
        <p>Sources, limitations, and uncertainty remain visible throughout every investigation.</p>
      </div>
      <Navigation persistenceKey="capela-sidebar-scroll" />
      <Account onRequestLogout={onRequestLogout} />
    </>
  );
}
