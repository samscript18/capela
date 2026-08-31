"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, FlaskConical, Home, Plus, Settings, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { appShellStyles as styles } from "@/components/app-shell.styles";
import { ProtectedRoute } from "@/components/protected-route";
import { useCapelaAuth } from "@/components/providers";
import { SessionLoadingGate } from "@/components/session-loading-gate";
import {
  type ApiNotification,
  useMarkNotificationRead,
  useMe,
  useNotifications,
  useNotificationUnreadCount,
} from "@/lib/api";

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/dashboard/investigate": "Try now",
  "/dashboard/investigations": "Investigations",
  "/notifications": "Notifications",
  "/profile": "Profile",
  "/settings": "Settings",
};

const mobileNavigation = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/investigate", icon: Sparkles, label: "Try now" },
  {
    href: "/dashboard/investigations",
    icon: FlaskConical,
    label: "Research",
  },
  { href: "/notifications", icon: Bell, label: "Notices" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NewInvestigationButton({ className = "" }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`inline-flex shrink-0 ${className}`}
      layout={!reduceMotion}
      onHoverEnd={() => setExpanded(false)}
      onHoverStart={() => setExpanded(true)}
      transition={{ type: "spring", stiffness: 430, damping: 34 }}
    >
      <Link
        aria-label="New investigation"
        className={styles.newInvestigation}
        href="/dashboard/investigate"
        onBlur={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onPointerDown={() => setExpanded(true)}
      >
        <motion.span
          animate={expanded && !reduceMotion ? { rotate: 90, scale: 0.92 } : { rotate: 0, scale: 1 }}
          aria-hidden="true"
          className="grid shrink-0 place-items-center"
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
        >
          <Plus size={21} strokeWidth={3} />
        </motion.span>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.span
              animate={{ opacity: 1, width: "auto", x: 0 }}
              className="overflow-hidden"
              exit={{ opacity: 0, width: 0, x: -8 }}
              initial={reduceMotion ? false : { opacity: 0, width: 0, x: -8 }}
              transition={{
                duration: reduceMotion ? 0 : 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              New investigation
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  );
}

function MenuBars() {
  return (
    <span aria-hidden="true" className="grid w-[18px] gap-[4px]">
      <span className="h-px w-full bg-current" />
      <span className="ml-auto h-px w-[13px] bg-current" />
      <span className="h-px w-[16px] bg-current" />
    </span>
  );
}

function WorkspaceUnavailable({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className={styles.gate}>
      <span>We could not connect</span>
      <h1>The workspace could not be opened.</h1>
      <p>{message}</p>
      <button onClick={retry} type="button">
        Retry connection
      </button>
    </main>
  );
}

function NotificationDrawer({
  close,
  notices,
  markRead,
  pending,
  failed,
}: {
  close: () => void;
  notices: ApiNotification[];
  markRead: (id: string) => void;
  pending: boolean;
  failed: boolean;
}) {
  return (
    <div className={styles.drawerBackdrop} role="presentation">
      <aside
        aria-labelledby="notification-drawer-title"
        aria-modal="true"
        className={styles.notificationDrawer}
        role="dialog"
      >
        <header>
          <div>
            <span>Activity preview</span>
            <h2 id="notification-drawer-title">Notifications</h2>
          </div>
          <button aria-label="Close notifications" onClick={close} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        {pending && <p aria-busy="true">Loading investigation activity…</p>}
        {failed && <div role="alert">Investigation activity could not be loaded right now.</div>}
        {!pending && !failed && notices.length === 0 && (
          <p>No notifications are available. Real investigation activity will appear here.</p>
        )}
        {notices.length > 0 && (
          <ol>
            {notices.slice(0, 8).map((notice) => (
              <li data-read={Boolean(notice.readAt)} key={notice._id}>
                <span>{notice.type.replaceAll("_", " ")}</span>
                <strong>{notice.title}</strong>
                <p>{notice.message}</p>
                {notice.actionUrl?.startsWith("/") && (
                  <Link
                    href={notice.actionUrl}
                    onClick={() => {
                      if (!notice.readAt) markRead(notice._id);
                      close();
                    }}
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
        <footer>
          <Link href="/notifications" onClick={close}>
            Open full activity ledger
          </Link>
        </footer>
      </aside>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { logout } = useCapelaAuth();
  const profile = useMe();
  const notifications = useNotifications();
  const unreadStatus = useNotificationUnreadCount();
  const markNotificationRead = useMarkNotificationRead();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const [notificationDrawer, setNotificationDrawer] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const notices = notifications.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = unreadStatus.data?.unreadCount ?? notices.filter((notice) => !notice.readAt).length;

  let workspace: ReactNode;
  if (profile.isPending) {
    workspace = <SessionLoadingGate />;
  } else if (profile.isError || !profile.data) {
    workspace = (
      <WorkspaceUnavailable
        message={
          profile.error instanceof Error ? profile.error.message : "Capela could not restore the workspace session."
        }
        retry={() => void profile.refetch()}
      />
    );
  } else {
    const title =
      pageTitles[pathname] ?? (pathname.startsWith("/dashboard/investigations/") ? "Investigation" : "Workspace");

    workspace = (
      <div className={styles.shell}>
        <a
          className="fixed left-4 top-4 z-[1000] -translate-y-[160%] bg-foreground px-4 py-3 text-background transition-transform duration-150 focus:translate-y-0"
          href="#workspace-content"
        >
          Skip to workspace
        </a>
        <aside className={styles.sidebar}>
          <AppSidebar onRequestLogout={() => setLogoutDialog(true)} />
        </aside>
        <div className={styles.workspace}>
          <header className={styles.topbar}>
            <div>
              <span>Here is what is happening</span>
              <strong>{title}</strong>
            </div>
            <div className={styles.topbarActions}>
              <button
                aria-label={unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications"}
                className={styles.notificationTrigger}
                onClick={() => setNotificationDrawer(true)}
                type="button"
              >
                <Bell aria-hidden="true" size={18} strokeWidth={1.8} />
                {unread > 0 && (
                  <span aria-hidden="true" className={styles.notificationBadge}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
              <NewInvestigationButton className="max-sm:hidden" />
              <details className={styles.mobileNavigation} ref={mobileMenu}>
                <summary>
                  <span className="sr-only">Navigation menu</span>
                  <MenuBars />
                </summary>
                <div className={styles.mobileMenuPanel}>
                  <AppSidebar
                    mobile
                    onNavigate={() => {
                      if (mobileMenu.current) mobileMenu.current.open = false;
                    }}
                    onRequestLogout={() => {
                      if (mobileMenu.current) mobileMenu.current.open = false;
                      setLogoutDialog(true);
                    }}
                  />
                </div>
              </details>
            </div>
          </header>
          <motion.main
            animate={{
              opacity: 1,
              transitionEnd: { transform: "none" },
              y: 0,
            }}
            className={styles.content}
            id="workspace-content"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            key={pathname}
            tabIndex={-1}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.1, 1] }}
          >
            {children}
          </motion.main>
        </div>
        <nav aria-label="Quick navigation" className={styles.mobileBottomNavigation}>
          {mobileNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active ? `${styles.mobileBottomItem} ${styles.mobileBottomItemActive}` : styles.mobileBottomItem
                }
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {notificationDrawer && (
          <NotificationDrawer
            close={() => setNotificationDrawer(false)}
            failed={notifications.isError}
            markRead={(id) => markNotificationRead.mutate(id)}
            notices={notices}
            pending={notifications.isPending}
          />
        )}
        <Dialog.Root open={logoutDialog} onOpenChange={setLogoutDialog}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.dialogBackdrop} />
            <Dialog.Content
              className={`${styles.logoutDialog} fixed top-1/2 left-1/2 z-101 -translate-x-1/2 -translate-y-1/2`}
            >
              <span>Account action</span>
              <Dialog.Title>Log out of this session?</Dialog.Title>
              <Dialog.Description className="mt-2 text-xs!">
                This browser will disconnect from your private Capela workspace. Your investigations and dossiers remain
                stored with your account.
              </Dialog.Description>
              <footer>
                <Dialog.Close className="text-xs!">Stay signed in</Dialog.Close>
                <button onClick={() => void logout()} type="button" className="text-xs! text-red-600">
                  Log out
                </button>
              </footer>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    );
  }

  return <ProtectedRoute>{workspace}</ProtectedRoute>;
}
