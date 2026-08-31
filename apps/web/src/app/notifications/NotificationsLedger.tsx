"use client";

import Link from "next/link";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationUnreadCount,
  useNotifications,
  useRemoveNotification,
} from "@/lib/api";
import { notificationStyles as styles } from "./notifications.styles";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function moleculeLabel(metadata: Record<string, unknown>) {
  return typeof metadata.molecule === "string" ? metadata.molecule : undefined;
}

export default function NotificationsLedger() {
  const notifications = useNotifications();
  const unreadStatus = useNotificationUnreadCount();
  const read = useMarkNotificationRead();
  const readAll = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const records = notifications.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = unreadStatus.data?.unreadCount ?? records.filter((record) => !record.readAt).length;
  const mutationError = read.error ?? readAll.error ?? remove.error;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span>Your Capela activity</span>
        <h1>Stay connected to every investigation that matters.</h1>
        <div>
          <p>Follow completed dossiers and investigation failures from one focused activity stream.</p>
          <button disabled={readAll.isPending || unread === 0} onClick={() => readAll.mutate()} type="button">
            {readAll.isPending ? "Updating…" : `Mark all read (${unread})`}
          </button>
        </div>
      </header>

      {mutationError && (
        <p className={styles.mutationError} role="alert">
          {mutationError.message}
        </p>
      )}
      {notifications.isPending && (
        <div className={styles.loading} aria-busy="true">
          <span>Loading notifications</span>
          {[0, 1, 2].map((item) => (
            <div key={item} />
          ))}
        </div>
      )}
      {notifications.isError && (
        <section className={styles.error} role="alert">
          <span>Notification service unavailable</span>
          <h2>Your activity ledger could not be loaded.</h2>
          <p>{notifications.error.message}</p>
          <button type="button" onClick={() => void notifications.refetch()}>
            Retry
          </button>
        </section>
      )}
      {!notifications.isPending && !notifications.isError && records.length === 0 && (
        <section className={styles.empty}>
          <span>No notifications</span>
          <h2>Your activity ledger is empty.</h2>
          <p>Capela does not generate demonstration notifications. Real investigation events will appear here.</p>
        </section>
      )}
      {records.length > 0 && (
        <ol className={styles.ledger}>
          {records.map((record) => (
            <li data-read={Boolean(record.readAt)} key={record._id}>
              <div className={styles.marker} aria-hidden="true" />
              <div>
                <span>{record.type.replaceAll("_", " ")}</span>
                <h2>{record.title}</h2>
                <p>{record.message}</p>
                <small>
                  {formatDate(record.createdAt)}
                  {moleculeLabel(record.metadata) ? ` · ${moleculeLabel(record.metadata)}` : ""}
                </small>
              </div>
              <div className={styles.recordActions}>
                {record.actionUrl?.startsWith("/") && <Link href={record.actionUrl}>Open</Link>}
                {!record.readAt && (
                  <button disabled={read.isPending} onClick={() => read.mutate(record._id)} type="button">
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {notifications.hasNextPage && (
        <button
          className={styles.loadMore}
          disabled={notifications.isFetchingNextPage}
          onClick={() => void notifications.fetchNextPage()}
          type="button"
        >
          {notifications.isFetchingNextPage ? "Loading more…" : "Load older notifications"}
        </button>
      )}
    </div>
  );
}
