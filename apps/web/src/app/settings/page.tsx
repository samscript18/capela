"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { useCapelaAuth } from "@/components/providers";
import {
  useAccess,
  useDeleteAccount,
  useDeleteInvestigationHistory,
  useInvestigations,
  useMe,
  useUpdateMe,
} from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import SecuritySettings from "./SecuritySettings";
import SettingsNav, { type SettingsSection } from "./SettingsNav";
import { settingsStyles as styles } from "./settings.styles";

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Not available"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function shortenAddress(value?: string) {
  if (!value) return "Not available";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function networkName(chainId?: number) {
  if (chainId === 84532) return "Base Sepolia";
  if (chainId === 8453) return "Base";
  return chainId ? `Base · chain ${chainId}` : "Base network";
}

export default function SettingsPage() {
  const { email: authEmail, walletAddress } = useCapelaAuth();
  const [section, setSection] = useState<SettingsSection>("general");
  const [copied, setCopied] = useState(false);
  const profile = useMe();
  const access = useAccess();
  const investigations = useInvestigations();
  const profileMutation = useUpdateMe();
  const preferenceMutation = useUpdateMe();
  const deleteHistory = useDeleteInvestigationHistory();

  if (profile.isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <span>Loading settings</span>
        <h1>Opening your account preferences…</h1>
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <section className={styles.error} role="alert">
        <span>Settings unavailable</span>
        <h1>Your account settings could not be opened.</h1>
        <p>
          {profile.error instanceof Error ? profile.error.message : "Capela could not restore your account record."}
        </p>
        <button type="button" onClick={() => void profile.refetch()}>
          Retry
        </button>
      </section>
    );
  }

  const record = profile.data;
  const displayName = record.displayName || record.email || authEmail || "Capela researcher";
  const email = record.email ?? authEmail ?? "Email not shared";
  const address = record.primaryWalletAddress ?? walletAddress;
  const avatarUrl = record.avatarUrl?.trim();
  const avatarStyle = avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined;
  const chainId = access.data?.chainId;
  const explorer = chainId === 84532 ? "https://sepolia.basescan.org" : "https://basescan.org";

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    profileMutation.mutate({ displayName: String(data.get("displayName") ?? "") });
  };
  const submitPreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    preferenceMutation.mutate({
      preferences: {
        compactEvidence: data.has("compactEvidence"),
        openEvidenceInDrawer: data.has("openEvidenceInDrawer"),
      },
    });
  };
  const copyAddress = async () => {
    if (!address || !(await copyText(address))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span>Your Capela experience</span>
        <h1>Shape the workspace around how you investigate evidence.</h1>
        <p>
          Keep your identity recognizable, tune the dossier interface, and manage the real account data connected to
          your research workspace.
        </p>
      </header>

      <SettingsNav active={section} onChange={setSection} />

      {section === "general" && (
        <>
          <section className={styles.profileSummary} aria-labelledby="settings-profile-name">
            <div className={styles.profileSummaryAvatar} style={avatarStyle}>
              {!avatarUrl && displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className={styles.profileSummaryBody}>
              <span>
                <UserRound aria-hidden="true" size={13} />
                Account identity
              </span>
              <h2 id="settings-profile-name">{displayName}</h2>
              <p>{email}</p>
              <div>
                <span data-tone="positive">
                  <CheckCircle2 aria-hidden="true" size={13} />
                  Active
                </span>
                <span>
                  <ShieldCheck aria-hidden="true" size={13} />
                  Privy verified
                </span>
              </div>
            </div>
            <Link className={styles.profileSummaryAction} href="/profile">
              View full profile
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </section>

          <div className={styles.profileContentGrid}>
            <form className={styles.profileSettingsCard} onSubmit={submitProfile}>
              <header className={styles.settingsCardHeader}>
                <span>
                  <PencilLine aria-hidden="true" size={18} />
                </span>
                <div>
                  <small>Profile details</small>
                  <h2>Present a clear account identity</h2>
                  <p>Update the one profile field Capela stores directly. Privy remains the identity source.</p>
                </div>
              </header>

              <div className={styles.profileFormSections}>
                <fieldset className={styles.profileFieldset}>
                  <legend>Personal identity</legend>
                  <p>Choose the display name shown throughout your private workspace.</p>
                  <div className={styles.profileFormGrid}>
                    <label>
                      <span>Display name</span>
                      <input
                        autoComplete="name"
                        defaultValue={record.displayName ?? ""}
                        key={record.displayName ?? "unset"}
                        maxLength={80}
                        name="displayName"
                        placeholder="Add a display name"
                      />
                    </label>
                    <label>
                      <span>Email address</span>
                      <input disabled value={email} />
                      <small>Email changes are managed through Privy.</small>
                    </label>
                  </div>
                </fieldset>
              </div>

              {(profileMutation.isError || profileMutation.isSuccess) && (
                <p
                  className={profileMutation.isError ? styles.profileFormError : styles.profileFormSuccess}
                  role="status"
                >
                  {profileMutation.isError ? profileMutation.error.message : "Your display name is now up to date."}
                </p>
              )}
              <footer className={styles.profileFormFooter}>
                <span>Changes are saved to your real Capela account.</span>
                <button disabled={profileMutation.isPending} type="submit">
                  {profileMutation.isPending ? "Saving profile…" : "Save profile"}
                </button>
              </footer>
            </form>

            <section className={styles.accountSettingsCard} aria-labelledby="account-record-title">
              <header className={styles.settingsCardHeader}>
                <span>
                  <ShieldCheck aria-hidden="true" size={18} />
                </span>
                <div>
                  <small>Account record</small>
                  <h2 id="account-record-title">Verified workspace identity</h2>
                  <p>Read-only account facts returned by Privy and the Capela API.</p>
                </div>
              </header>
              <dl className={styles.accountFacts}>
                <div>
                  <dt>Email</dt>
                  <dd title={email}>{email}</dd>
                </div>
                <div>
                  <dt>Display name</dt>
                  <dd>{record.displayName || "Not set"}</dd>
                </div>
                <div>
                  <dt>Authentication</dt>
                  <dd>Privy verified</dd>
                </div>
                <div>
                  <dt>Account scope</dt>
                  <dd>Personal research workspace</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>{formatDate(record.createdAt)}</dd>
                </div>
                <div>
                  <dt>Wallet</dt>
                  <dd title={address}>{shortenAddress(address)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}

      {section === "preferences" && (
        <>
          <form className={styles.formSection} onSubmit={submitPreferences}>
            <header>
              <span>Dossier experience</span>
              <h2>Investigation preferences.</h2>
            </header>
            <div className={styles.preferenceList}>
              <label>
                <span>
                  <strong>Compact evidence cards</strong>
                  <small>Reduce card spacing while keeping evidence classifications and source context visible.</small>
                </span>
                <input
                  aria-label="Compact evidence cards"
                  defaultChecked={record.preferences.compactEvidence}
                  key={`compact-${String(record.preferences.compactEvidence)}`}
                  name="compactEvidence"
                  role="switch"
                  type="checkbox"
                />
              </label>
              <label>
                <span>
                  <strong>Open evidence details in side drawer</strong>
                  <small>Keep your dossier position while inspecting claims and supporting publications.</small>
                </span>
                <input
                  aria-label="Open evidence details in side drawer"
                  defaultChecked={record.preferences.openEvidenceInDrawer}
                  key={`drawer-${String(record.preferences.openEvidenceInDrawer)}`}
                  name="openEvidenceInDrawer"
                  role="switch"
                  type="checkbox"
                />
              </label>
            </div>
            {(preferenceMutation.isError || preferenceMutation.isSuccess) && (
              <p className={preferenceMutation.isError ? styles.formError : styles.formSuccess} role="status">
                {preferenceMutation.isError ? preferenceMutation.error.message : "Investigation preferences saved."}
              </p>
            )}
            <button disabled={preferenceMutation.isPending} type="submit">
              {preferenceMutation.isPending ? "Saving preferences…" : "Save preferences"}
            </button>
          </form>

          <section className={styles.privacyPanel}>
            <header>
              <h2>Current evidence view.</h2>
              <p>
                These settings affect dossier presentation only. They never change the scientific evidence, grading,
                citations, or assessment stored in an investigation.
              </p>
            </header>
            <dl className={styles.privacyStatus}>
              <div>
                <dt>Card density</dt>
                <dd>{record.preferences.compactEvidence ? "Compact" : "Comfortable"}</dd>
              </div>
              <div>
                <dt>Evidence details</dt>
                <dd>{record.preferences.openEvidenceInDrawer ? "Side drawer" : "Inline section"}</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {section === "security" && <SecuritySettings />}

      {section === "access" && (
        <>
          <section className={styles.profileSummary} aria-labelledby="wallet-access-title">
            <div className={styles.profileSummaryAvatar}>
              <Wallet aria-hidden="true" />
            </div>
            <div className={styles.profileSummaryBody}>
              <span>
                <KeyRound aria-hidden="true" size={13} />
                Wallet and access
              </span>
              <h2 id="wallet-access-title">{address ? "Connected wallet" : "Wallet provisioning pending"}</h2>
              <p title={address}>{address ?? "Privy will surface an embedded or connected EVM wallet here."}</p>
              <div>
                <span data-tone="positive">
                  <CheckCircle2 aria-hidden="true" size={13} />
                  {access.data?.unlimitedInvestigations ? "Free preview" : "Access active"}
                </span>
                <span>
                  <Wallet aria-hidden="true" size={13} />
                  {networkName(chainId)}
                </span>
              </div>
            </div>
            <button
              className={styles.profileSummaryAction}
              disabled={!address}
              onClick={() => void copyAddress()}
              type="button"
            >
              {copied ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}
              {copied ? "Address copied" : "Copy address"}
            </button>
          </section>

          <section className={styles.privacyPanel}>
            <header>
              <h2>Preview access.</h2>
              <p>
                Payments are paused during the free preview. Your real Privy wallet remains part of your account and can
                be inspected on the configured Base network.
              </p>
            </header>
            <div className={styles.privacyActions}>
              {address && (
                <a href={`${explorer}/address/${address}`} rel="noreferrer" target="_blank">
                  View on explorer
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              )}
            </div>
            <dl className={styles.privacyStatus}>
              <div>
                <dt>Wallet</dt>
                <dd>{address ?? "Not yet provisioned"}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{networkName(chainId)}</dd>
              </div>
              <div>
                <dt>Investigation access</dt>
                <dd>{access.data?.unlimitedInvestigations ? "Free during preview" : "Daily access rules active"}</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>{access.data?.paymentsEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              {access.data?.paymentsEnabled && (
                <div>
                  <dt>Price</dt>
                  <dd>{access.data.priceWei} wei</dd>
                </div>
              )}
            </dl>
          </section>
        </>
      )}

      {section === "privacy" && (
        <>
          <section className={styles.privacyPanel}>
            <header>
              <h2>Investigation history.</h2>
              <p>
                Remove every investigation and dossier associated with this authenticated Capela account. Your Privy
                identity and profile remain intact.
              </p>
            </header>
            <div className={styles.privacyActions}>
              {deleteHistory.isSuccess ? (
                <span role="status">
                  {deleteHistory.data.deletedCount
                    ? `${deleteHistory.data.deletedCount} investigation record${deleteHistory.data.deletedCount === 1 ? "" : "s"} deleted.`
                    : "Investigation history is already empty."}
                </span>
              ) : (
                <DeleteHistoryDialog
                  error={deleteHistory.isError ? deleteHistory.error.message : undefined}
                  pending={deleteHistory.isPending}
                  onConfirm={(onSuccess) => deleteHistory.mutate(undefined, { onSuccess })}
                />
              )}
            </div>
            <dl className={styles.privacyStatus}>
              <div>
                <dt>Stored records</dt>
                <dd>{investigations.isPending ? "Loading" : (investigations.data?.length ?? 0)}</dd>
              </div>
              <div>
                <dt>Deletion scope</dt>
                <dd>Investigations, generated dossiers, and related notifications</dd>
              </div>
            </dl>
          </section>

          <section className={styles.privacyPanel}>
            <header>
              <h2>Account deletion.</h2>
              <p>
                Permanently remove your Capela profile, research records, notifications, session registry, payment
                records, Cloudinary avatar, and Privy identity. This cannot be undone.
              </p>
            </header>
            <div className={styles.privacyActions}>
              <DeleteAccountDialog accountLabel={email} />
            </div>
            <dl className={styles.privacyStatus}>
              <div>
                <dt>Deletion type</dt>
                <dd>Permanent</dd>
              </div>
              <div>
                <dt>Before deleting</dt>
                <dd>Move any assets you need from connected wallets and save any dossiers you want to keep.</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function DeleteAccountDialog({ accountLabel }: { accountLabel: string }) {
  const { logout } = useCapelaAuth();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation === "DELETE";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (deleteAccount.isPending) return;
        setOpen(next);
        if (!next) {
          setConfirmation("");
          deleteAccount.reset();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className={styles.danger} type="button">
          <ShieldAlert aria-hidden="true" size={15} />
          Delete account
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogBackdrop} />
        <Dialog.Content className={`${styles.dialog} fixed top-1/2 left-1/2 z-101 -translate-x-1/2 -translate-y-1/2`}>
          <header>
            <span>Account: {accountLabel}</span>
            <Dialog.Close aria-label="Close dialog" disabled={deleteAccount.isPending}>
              <X aria-hidden="true" size={18} />
            </Dialog.Close>
          </header>
          <Dialog.Title>Delete your Capela account permanently?</Dialog.Title>
          <Dialog.Description>
            This erases the account and its Capela data, removes the stored avatar from Cloudinary, and deletes the
            corresponding Privy user. You will be returned to the landing page and cannot recover the deleted dossiers.
          </Dialog.Description>
          <label className={styles.confirmationField}>
            <span>
              Type <strong>DELETE</strong> to confirm
            </span>
            <input
              autoComplete="off"
              disabled={deleteAccount.isPending}
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
          {deleteAccount.isError && (
            <p className={styles.profileFormError} role="alert">
              {deleteAccount.error.message}
            </p>
          )}
          <footer>
            <Dialog.Close disabled={deleteAccount.isPending}>Keep account</Dialog.Close>
            <button
              className={styles.danger}
              disabled={!confirmed || deleteAccount.isPending}
              onClick={() =>
                deleteAccount.mutate(undefined, {
                  onSuccess: () => void logout(),
                })
              }
              type="button"
            >
              {deleteAccount.isPending ? "Deleting account…" : "Delete account permanently"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteHistoryDialog({
  pending,
  error,
  onConfirm,
}: {
  pending: boolean;
  error?: string;
  onConfirm: (onSuccess: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <Dialog.Trigger asChild>
        <button className={styles.danger} disabled={pending} type="button">
          <ShieldAlert aria-hidden="true" size={15} />
          Delete investigation history
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogBackdrop} />
        <Dialog.Content className={`${styles.dialog} fixed top-1/2 left-1/2 z-101 -translate-x-1/2 -translate-y-1/2`}>
          <header>
            <span>Stored research records</span>
            <Dialog.Close aria-label="Close dialog" disabled={pending}>
              <X aria-hidden="true" size={18} />
            </Dialog.Close>
          </header>
          <Dialog.Title>Delete all investigation history?</Dialog.Title>
          <Dialog.Description>
            This permanently removes every stored investigation and generated dossier from your Capela account. The
            action cannot be undone.
          </Dialog.Description>
          {error && (
            <p className={styles.profileFormError} role="alert">
              {error}
            </p>
          )}
          <footer>
            <Dialog.Close disabled={pending}>Keep history</Dialog.Close>
            <button
              className={styles.danger}
              disabled={pending}
              onClick={() => onConfirm(() => setOpen(false))}
              type="button"
            >
              {pending ? "Deleting history…" : "Delete history"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
