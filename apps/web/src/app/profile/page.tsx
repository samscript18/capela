"use client";

import {
  AtSign,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleUserRound,
  FlaskConical,
  KeyRound,
  ImagePlus,
  Mail,
  PencilLine,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useCapelaAuth } from "@/components/providers";
import { useAccess, useInvestigations, useMe, useUpdateMe, useUploadAvatar } from "@/lib/api";
import { profileStyles as styles } from "./profile.styles";

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

export default function ProfilePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [avatarValidationError, setAvatarValidationError] = useState<string>();
  const { email: authEmail, walletAddress } = useCapelaAuth();
  const profile = useMe();
  const investigations = useInvestigations();
  const access = useAccess();
  const updateProfile = useUpdateMe();
  const uploadAvatar = useUploadAvatar();

  if (profile.isPending) {
    return <div className={styles.state}>Opening profile…</div>;
  }
  if (profile.isError || !profile.data) {
    return (
      <section className={styles.error} role="alert">
        <span>Profile unavailable</span>
        <h1>Your profile could not be loaded.</h1>
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
  const email = record.email ?? authEmail ?? "Email not shared";
  const name = record.displayName || record.email || authEmail || "Capela researcher";
  const address = record.primaryWalletAddress ?? walletAddress;
  const avatarUrl = record.avatarUrl?.trim();
  const avatarStyle = avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined;
  const records = investigations.data ?? [];
  const completed = records.filter((item) => item.status === "completed").length;
  const accessStatus = access.data?.unlimitedInvestigations
    ? "Free preview active"
    : access.data
      ? `${access.data.freeInvestigationsRemaining} free remaining today`
      : "Access status loading";
  const accountDetails = [
    { icon: Mail, label: "Email address", value: email },
    { icon: AtSign, label: "Display name", value: record.displayName || "Not set" },
    { icon: CalendarDays, label: "Member since", value: formatDate(record.createdAt) },
    { icon: ShieldCheck, label: "Authentication", value: "Verified" },
    { icon: Wallet, label: "Connected wallet", value: shortenAddress(address) },
    {
      icon: FlaskConical,
      label: "Investigations saved",
      value: investigations.isPending ? "Loading" : String(records.length),
    },
    {
      icon: CheckCircle2,
      label: "Dossiers completed",
      value: investigations.isPending ? "Loading" : String(completed),
    },
    { icon: KeyRound, label: "Investigation access", value: accessStatus },
  ] as const;

  const submitDisplayName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateProfile.mutate({ displayName: String(data.get("displayName") ?? "") });
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span>Your Capela identity</span>
        <h1>A profile built around your investigation workspace.</h1>
        <p>
          Keep your account identity recognizable and review the real research activity attached to your private Capela
          workspace.
        </p>
      </header>

      <section className={styles.hero} aria-labelledby="profile-name">
        <div
          aria-label={avatarUrl ? `${name}'s avatar` : undefined}
          className={styles.avatar}
          role={avatarUrl ? "img" : undefined}
          style={avatarStyle}
        >
          {!avatarUrl && name.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.heroIdentity}>
          <span>
            <UserRound aria-hidden="true" size={13} />
            Account profile
          </span>
          <h2 id="profile-name">{name}</h2>
          <p className={styles.username}>{email}</p>
          <p className={styles.bio}>
            Your Privy identity, saved investigations, and evidence-view preferences stay connected across Capela.
          </p>
          <div className={styles.heroActions}>
            <Link href="#profile-editor">
              <PencilLine aria-hidden="true" size={15} />
              Edit profile
            </Link>
            <Link href="/settings">
              <Settings aria-hidden="true" size={15} />
              Settings
            </Link>
          </div>
        </div>
        <div className={styles.heroStatus}>
          <span data-tone="positive">
            <CheckCircle2 aria-hidden="true" size={14} />
            Account active
          </span>
          <span>
            <ShieldCheck aria-hidden="true" size={14} />
            Authenticated
          </span>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.researchSummary} aria-label="Research workspace summary">
          <div>
            <small>Research workspace</small>
            <strong>Your Capela record</strong>
            <p>Live investigation totals and access state from this authenticated account.</p>
          </div>
          <div>
            <small>Completed</small>
            <strong>{investigations.isPending ? "—" : completed}</strong>
          </div>
          <div>
            <small>Saved records</small>
            <strong>{investigations.isPending ? "—" : records.length}</strong>
          </div>
          <div>
            <small>Access</small>
            <strong>{access.data?.unlimitedInvestigations ? "Preview" : accessStatus}</strong>
          </div>
        </section>

        <section className={styles.details} aria-labelledby="account-details">
          <header className={styles.panelHeader}>
            <span>
              <UserRound aria-hidden="true" size={16} />
            </span>
            <div>
              <small>Account record</small>
              <h2 id="account-details">Your profile details</h2>
              <p>Identity, wallet, access, and research activity returned by your account.</p>
            </div>
          </header>
          <dl className={styles.detailGrid}>
            {accountDetails.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <span>
                  <Icon aria-hidden="true" size={16} />
                </span>
                <div>
                  <dt>{label}</dt>
                  <dd title={value}>{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <form className={styles.editor} id="profile-editor" onSubmit={submitDisplayName}>
          <header className={styles.panelHeader}>
            <span>
              <CircleUserRound aria-hidden="true" size={16} />
            </span>
            <div>
              <small>Display identity</small>
              <h2>Keep your account recognizable</h2>
              <p>Capela only lets you edit the display name stored on your account.</p>
            </div>
          </header>

          <div className={styles.identityPreview}>
            <div aria-hidden="true" style={avatarStyle}>
              {!avatarUrl && name.slice(0, 1).toUpperCase()}
            </div>
            <span>
              <strong>{name}</strong>
              <small>{email}</small>
            </span>
          </div>

          <label className={styles.editorField}>
            <span>Display name</span>
            <input
              autoComplete="name"
              defaultValue={record.displayName ?? ""}
              key={record.displayName ?? "unset"}
              maxLength={80}
              name="displayName"
              placeholder="Add a display name"
            />
            <small>Your email, avatar, and wallet identity continue to come from Privy.</small>
          </label>

          {updateProfile.isError && (
            <p className={styles.formError} role="alert">
              {updateProfile.error.message}
            </p>
          )}
          {updateProfile.isSuccess && (
            <p className={styles.formSuccess} role="status">
              Your display name is now up to date.
            </p>
          )}
          <button disabled={updateProfile.isPending} type="submit">
            <Save aria-hidden="true" size={16} />
            {updateProfile.isPending ? "Saving profile…" : "Save display name"}
          </button>
        </form>

        <section className={styles.upload} aria-labelledby="profile-photo">
          <header className={styles.panelHeader}>
            <span>
              <Camera aria-hidden="true" size={16} />
            </span>
            <div>
              <small>Profile photo</small>
              <h2 id="profile-photo">Edit your account image</h2>
              <p>Choose a JPG, PNG, or WebP image. Capela validates it before Cloudinary stores the final avatar.</p>
            </div>
          </header>

          <div className={styles.photoPreview}>
            <div aria-hidden="true" style={avatarStyle}>
              {!avatarUrl && name.slice(0, 1).toUpperCase()}
            </div>
            <span>
              <strong>Current account image</strong>
              <small>Shown in your workspace navigation and profile.</small>
            </span>
          </div>

          <label className={styles.filePicker}>
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const next = event.target.files?.[0];
                uploadAvatar.reset();
                setAvatarValidationError(undefined);
                if (!next) {
                  setAvatarFile(undefined);
                  return;
                }
                if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
                  setAvatarFile(undefined);
                  setAvatarValidationError("Choose a JPG, PNG, or WebP image.");
                  event.target.value = "";
                  return;
                }
                if (next.size <= 0 || next.size > 5 * 1024 * 1024) {
                  setAvatarFile(undefined);
                  setAvatarValidationError("Choose a non-empty image no larger than 5 MB.");
                  event.target.value = "";
                  return;
                }
                setAvatarFile(next);
              }}
              ref={fileInput}
              type="file"
            />
            <span>
              <ImagePlus aria-hidden="true" size={20} />
            </span>
            <strong>{avatarFile ? "Choose a different image" : "Choose an image"}</strong>
            <small>JPG, PNG, or WebP · maximum 5 MB</small>
          </label>

          {avatarFile && (
            <div className={styles.selectedFile}>
              <CheckCircle2 aria-hidden="true" size={16} />
              <span>
                <strong>{avatarFile.name}</strong>
                <small>{Math.ceil(avatarFile.size / 1024)} KB ready to upload</small>
              </span>
            </div>
          )}
          {avatarValidationError && (
            <p className={styles.uploadError} role="alert">
              {avatarValidationError}
            </p>
          )}
          {uploadAvatar.isError && (
            <p className={styles.uploadError} role="alert">
              {uploadAvatar.error.message}
            </p>
          )}
          {uploadAvatar.isSuccess && (
            <p className={styles.uploadSuccess} role="status">
              Profile image updated across your Capela workspace.
            </p>
          )}
          <button
            disabled={!avatarFile || uploadAvatar.isPending}
            onClick={() => {
              if (!avatarFile) return;
              uploadAvatar.mutate(avatarFile, {
                onSuccess: () => {
                  setAvatarFile(undefined);
                  if (fileInput.current) fileInput.current.value = "";
                },
              });
            }}
            type="button"
          >
            <Camera aria-hidden="true" size={16} />
            {uploadAvatar.isPending ? "Uploading image…" : "Update profile image"}
          </button>
        </section>
      </div>
    </div>
  );
}
