"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock, Clock3, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useCapelaAuth } from "@/components/providers";
import { type AccountSession, useAccountSessions, useRevokeOtherSessions, useRevokeSession } from "@/lib/api";
import { settingsStyles as styles } from "./settings.styles";

function formatDate(value?: string) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function describeSession(session: AccountSession) {
  const device =
    session.deviceName || [session.browser, session.platform].filter(Boolean).join(" on ") || "Browser session";
  const environment = session.userAgentSummary || [session.browser, session.platform].filter(Boolean).join(" · ");
  return { device, environment: environment || "Authenticated with Privy" };
}

function authenticationLabel(methods: string[]) {
  const labels = methods.map((method) => {
    if (method === "email") return "Email one-time code";
    if (method === "google_oauth") return "Google";
    if (method === "wallet") return "Wallet";
    return method.replaceAll("_", " ");
  });
  return [...new Set(labels)].join(" · ") || "Privy authentication";
}

export default function SecuritySettings() {
  const { authMethods, logout, supportsPasswordChange } = useCapelaAuth();
  const [selectedSession, setSelectedSession] = useState<AccountSession>();
  const [otherSessionsDialog, setOtherSessionsDialog] = useState(false);
  const sessions = useAccountSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const activeSessions = sessions.data ?? [];
  const otherSessions = activeSessions.filter((session) => !session.current);
  const pending = revoke.isPending || revokeOthers.isPending;
  const mutationError = revoke.error ?? revokeOthers.error;

  const closeDialog = () => {
    if (pending) return;
    setSelectedSession(undefined);
    setOtherSessionsDialog(false);
    revoke.reset();
    revokeOthers.reset();
  };

  return (
    <>
      <section className={styles.formSection}>
        <header>
          <span>Password</span>
          <h2>{supportsPasswordChange ? "Password credential detected." : "No Capela password to change."}</h2>
        </header>
        <div className={styles.authenticationState}>
          <span>
            <KeyRound aria-hidden="true" size={18} />
          </span>
          <div>
            <strong>{authenticationLabel(authMethods)}</strong>
            <p>
              Capela uses Privy email one-time codes, Google, or wallet authentication. Those methods do not create a
              password stored by Capela. Manage Google or wallet credentials with that provider; you can control every
              observed Capela session below.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.securityPanel}>
        <header>
          <h2>Active sessions.</h2>
          <p>
            These are real Privy session identifiers observed by the Capela API. Revoked sessions are rejected by the
            backend even if a browser still holds an older token. IP addresses are not displayed.
          </p>
        </header>

        {sessions.isPending && <p aria-busy="true">Loading active sessions…</p>}
        {sessions.isError && (
          <div className={styles.sessionError} role="alert">
            <p>{sessions.error.message}</p>
            <button onClick={() => void sessions.refetch()} type="button">
              Retry sessions
            </button>
          </div>
        )}
        {sessions.data?.length === 0 && <p>No active sessions were returned for this account.</p>}
        {activeSessions.length > 0 && (
          <ul className={styles.sessionGrid}>
            {activeSessions.map((session) => {
              const { device, environment } = describeSession(session);
              return (
                <li className={styles.sessionCard} data-current={session.current} key={session.id}>
                  <header className={styles.sessionHeader}>
                    <span>
                      <MonitorSmartphone aria-hidden="true" size={20} />
                    </span>
                    <div>
                      <strong>{device}</strong>
                      <small>{environment}</small>
                    </div>
                    {session.current && (
                      <em>
                        <ShieldCheck aria-hidden="true" size={13} />
                        This device
                      </em>
                    )}
                  </header>
                  <dl className={styles.sessionDetails}>
                    <div>
                      <dt>
                        <Clock3 aria-hidden="true" size={12} />
                        Last active
                      </dt>
                      <dd>{formatDate(session.lastUsedAt)}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarClock aria-hidden="true" size={12} />
                        Expires
                      </dt>
                      <dd>{formatDate(session.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Session opened</dt>
                      <dd>{formatDate(session.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Access status</dt>
                      <dd>Active and authenticated</dd>
                    </div>
                  </dl>
                  <footer className={styles.sessionFooter}>
                    <span>
                      {session.current
                        ? "Signing out this session returns this browser to the landing page."
                        : "Remove access if you do not recognize this browser or device."}
                    </span>
                    <button onClick={() => setSelectedSession(session)} type="button" className="text-xs!">
                      <LogOut aria-hidden="true" size={14} />
                      {session.current ? "Sign out this device" : "Revoke access"}
                    </button>
                  </footer>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.securityActions}>
          <button
            disabled={sessions.isPending || otherSessions.length === 0}
            onClick={() => setOtherSessionsDialog(true)}
            type="button"
            className="text-xs!"
          >
            <LogOut aria-hidden="true" size={14} />
            Sign out other sessions
          </button>
        </div>
      </section>

      <Dialog.Root
        open={Boolean(selectedSession) || otherSessionsDialog}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogBackdrop} />
          <Dialog.Content className={`${styles.dialog} fixed top-1/2 left-1/2 z-101 -translate-x-1/2 -translate-y-1/2`}>
            <header>
              <span>Security confirmation</span>
              <Dialog.Close aria-label="Close dialog" disabled={pending}>
                <X aria-hidden="true" size={18} />
              </Dialog.Close>
            </header>
            <Dialog.Title>
              {otherSessionsDialog ? "Sign out every other session?" : "Revoke this session?"}
            </Dialog.Title>
            <Dialog.Description>
              {otherSessionsDialog
                ? `${otherSessions.length} other active session${otherSessions.length === 1 ? "" : "s"} will lose API access. This device stays signed in.`
                : selectedSession?.current
                  ? "This browser session will lose API access immediately and return to the Capela landing page."
                  : `The session for ${selectedSession ? describeSession(selectedSession).device : "this device"} will lose API access immediately.`}
            </Dialog.Description>
            {mutationError && (
              <p className={styles.profileFormError} role="alert">
                {mutationError.message}
              </p>
            )}
            <footer>
              <button disabled={pending} className="text-xs!" onClick={closeDialog} type="button">
                Keep sessions
              </button>
              <button
                className={styles.danger}
                style={{ fontSize: 12 }}
                disabled={pending}
                onClick={() => {
                  if (otherSessionsDialog) {
                    revokeOthers.mutate(undefined, { onSuccess: closeDialog });
                    return;
                  }
                  if (!selectedSession) return;
                  const current = selectedSession.current;
                  revoke.mutate(selectedSession.id, {
                    onSuccess: () => {
                      if (current) void logout();
                      else closeDialog();
                    },
                  });
                }}
                type="button"
              >
                {pending ? "Revoking…" : otherSessionsDialog ? "Sign out other sessions" : "Revoke session"}
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
