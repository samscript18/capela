"use client";

import type { AccessResponse, PaymentVerificationResponse, UserPreferences } from "@capela/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCapelaAuth } from "@/components/providers";
import { normalizeApiInvestigation, type ApiInvestigationPayload } from "@/lib/investigation-record";

export type { ApiInvestigation } from "@/lib/investigation-record";

export type ApiUser = {
  _id: string;
  privyUserId: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  primaryWalletAddress?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
};

export type AccountSession = {
  id: string;
  current: boolean;
  deviceName?: string;
  browser?: string;
  platform?: string;
  userAgentSummary?: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type ApiNotification = {
  _id: string;
  type: "INVESTIGATION_COMPLETED" | "INVESTIGATION_FAILED";
  title: string;
  message: string;
  actionUrl?: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  emailStatus: string;
  emailAttempts: number;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPage = {
  data: ApiNotification[];
  pagination: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasNextPage: boolean;
    limit: number;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, getAccessToken: () => Promise<string | null>, init?: RequestInit): Promise<T> {
  const hasJsonBody = Boolean(init?.body) && !(typeof FormData !== "undefined" && init?.body instanceof FormData);
  const request = async () => {
    const token = await getAccessToken();
    if (!token) throw new ApiError("Your authentication session is unavailable", 401);
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  };

  let response = await request();
  if (response.status === 401) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    response = await request();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(body.message ?? "Capela API request failed", response.status, body.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function useApiEnabled() {
  const auth = useCapelaAuth();
  return { ...auth, enabled: auth.ready && auth.authenticated && auth.configured };
}

export function useMe() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({ queryKey: ["me"], queryFn: () => apiFetch<ApiUser>("/me", getAccessToken), enabled });
}

export function useUpdateMe() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName?: string; preferences?: Partial<UserPreferences> }) =>
      apiFetch<ApiUser>("/me", getAccessToken, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });
}

export function useUploadAvatar() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return apiFetch<ApiUser>("/me/avatar", getAccessToken, { method: "PATCH", body });
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });
}

export function useAccountSessions() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({
    queryKey: ["account-sessions"],
    queryFn: () => apiFetch<AccountSession[]>("/sessions", getAccessToken),
    enabled,
  });
}

export function useRevokeSession() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/sessions/${encodeURIComponent(id)}`, getAccessToken, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["account-sessions"] }),
  });
}

export function useRevokeOtherSessions() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ revokedCount: number }>("/sessions", getAccessToken, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["account-sessions"] }),
  });
}

export function useDeleteAccount() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ deleted: true }>("/me", getAccessToken, { method: "DELETE" }),
    onSuccess: () => queryClient.clear(),
  });
}

export function useDeleteInvestigationHistory() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deletedCount: number; notificationsDeletedCount: number }>("/me/investigations", getAccessToken, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["investigations"] }),
        queryClient.invalidateQueries({ queryKey: ["access"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
  });
}

export function useAccess() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({
    queryKey: ["access"],
    queryFn: () => apiFetch<AccessResponse>("/access", getAccessToken),
    enabled,
  });
}

export function useInvestigations() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({
    queryKey: ["investigations"],
    queryFn: async () => {
      const records = await apiFetch<ApiInvestigationPayload[]>("/investigations", getAccessToken);
      return records.map(normalizeApiInvestigation);
    },
    enabled,
  });
}

export function useInvestigation(id: string) {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({
    queryKey: ["investigations", id],
    queryFn: async () =>
      normalizeApiInvestigation(await apiFetch<ApiInvestigationPayload>(`/investigations/${id}`, getAccessToken)),
    enabled: enabled && Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 2_000;
    },
  });
}

export function useCreateInvestigation() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { originalInput: string; paymentId?: string }) =>
      normalizeApiInvestigation(
        await apiFetch<ApiInvestigationPayload>("/investigations", getAccessToken, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["investigations"] }),
        queryClient.invalidateQueries({ queryKey: ["access"] }),
      ]);
    },
  });
}

export function useRetryInvestigation(id: string) {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      normalizeApiInvestigation(
        await apiFetch<ApiInvestigationPayload>(`/investigations/${id}/retry`, getAccessToken, { method: "POST" }),
      ),
    onSuccess: async (investigation) => {
      queryClient.setQueryData(["investigations", id], investigation);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["investigations"] }),
        queryClient.invalidateQueries({ queryKey: ["access"] }),
      ]);
    },
  });
}

export function useVerifyPayment() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionHash: `0x${string}`) =>
      apiFetch<PaymentVerificationResponse>("/payments/verify", getAccessToken, {
        method: "POST",
        body: JSON.stringify({ transactionHash }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["access"] });
    },
  });
}

export function useNotifications() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useInfiniteQuery<NotificationPage>({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ limit: "20" });
      if (typeof pageParam === "string") query.set("cursor", pageParam);
      return apiFetch<NotificationPage>(`/notifications?${query}`, getAccessToken);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useNotificationUnreadCount() {
  const { getAccessToken, enabled } = useApiEnabled();
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiFetch<{ unreadCount: number }>("/notifications/unread-count", getAccessToken),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiNotification>(`/notifications/${id}/read`, getAccessToken, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ updatedCount: number }>("/notifications/read-all", getAccessToken, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useRemoveNotification() {
  const { getAccessToken } = useApiEnabled();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notifications/${id}`, getAccessToken, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
