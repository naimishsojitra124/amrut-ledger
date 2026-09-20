import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { invalidateUsersChanged } from "./utils/query-invalidation";
import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";
import { apiConnector } from "@/services/utils/apiConnector";

export type UserRole = "owner" | "manager" | "employee" | "guest";

export type UserStatus = "active" | "inactive";

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UserResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: UserResponse[];
  pageInfo: PageInfo;
}

export interface UserStatsResponse {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  ownerCount: number;
  managerCount: number;
  employeeCount: number;
}

export interface CreateUserRequest {
  fullName: string;
  mobileNumber: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  fullName: string;
  mobileNumber: string;
  email: string;
}

export interface ChangeUserPasswordRequest {
  password: string;
}

export interface ChangeUserRoleRequest {
  role: UserRole;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

const ROOT_KEY = ["users"] as const;

const LIST_KEY = [...ROOT_KEY, "list"] as const;

const STATS_KEY = [...ROOT_KEY, "stats"] as const;

const DETAIL_KEY = [...ROOT_KEY, "detail"] as const;

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(typeof value === "number" && Number.isNaN(value)),
    ),
  );
}

function normalizeUser(user: UserResponse): UserResponse {
  return {
    ...user,
    lastLoginAt: user.lastLoginAt
      ? new Date(user.lastLoginAt).toISOString()
      : null,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

function listQueryKey(query: UserListQuery = {}) {
  return [
    ...LIST_KEY,
    {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      search: query.search?.trim() ?? "",
    },
  ] as const;
}

function findUserInListCaches(queryClient: QueryClient, id: string) {
  const cachedLists = queryClient.getQueriesData<UserListResponse>({
    queryKey: LIST_KEY,
  });

  for (const [, data] of cachedLists) {
    const found = data?.items.find((item) => item.id === id);

    if (found) {
      return found;
    }
  }

  return undefined;
}

function updateListCaches(
  queryClient: QueryClient,
  updater: (items: UserResponse[]) => UserResponse[],
) {
  const cachedLists = queryClient.getQueriesData<UserListResponse>({
    queryKey: LIST_KEY,
  });

  for (const [queryKey, data] of cachedLists) {
    if (!data) {
      continue;
    }

    queryClient.setQueryData<UserListResponse>(queryKey, {
      ...data,
      items: updater(data.items),
    });
  }
}

function updateDetailCaches(
  queryClient: QueryClient,
  updater: (user: UserResponse) => UserResponse,
) {
  const cachedDetails = queryClient.getQueriesData<UserResponse>({
    queryKey: DETAIL_KEY,
  });

  for (const [queryKey, data] of cachedDetails) {
    if (!data) {
      continue;
    }

    queryClient.setQueryData<UserResponse>(queryKey, updater(data));
  }
}

function buildOptimisticUser(
  existing: UserResponse | undefined,
  patch: Partial<UserResponse>,
): UserResponse {
  return normalizeUser({
    id: existing?.id ?? patch.id ?? "",

    fullName: patch.fullName ?? existing?.fullName ?? "",

    mobileNumber: patch.mobileNumber ?? existing?.mobileNumber ?? "",

    email: patch.email ?? existing?.email ?? "",

    role: patch.role ?? existing?.role ?? "employee",

    status: patch.status ?? existing?.status ?? "active",

    lastLoginAt: patch.lastLoginAt ?? existing?.lastLoginAt ?? null,

    createdAt:
      patch.createdAt ?? existing?.createdAt ?? new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  });
}

async function fetchUsers(
  query: UserListQuery = {},
  signal?: AbortSignal,
): Promise<UserListResponse> {
  const response = await apiConnector<UserListResponse>(
    "GET",
    "/users",
    undefined,
    undefined,
    cleanParams({
      page: query.page,
      limit: query.limit,
      search: query.search?.trim(),
    }),
    signal,
  );

  return {
    ...response.data,
    items: response.data.items.map(normalizeUser),
  };
}

async function fetchUserStats(
  signal?: AbortSignal,
): Promise<UserStatsResponse> {
  const response = await apiConnector<UserStatsResponse>(
    "GET",
    "/users/stats",
    undefined,
    undefined,
    undefined,
    signal,
  );

  return response.data;
}

async function fetchUserById(
  id: string,
  signal?: AbortSignal,
): Promise<UserResponse> {
  const response = await apiConnector<UserResponse>(
    "GET",
    `/users/${id}`,
    undefined,
    undefined,
    undefined,
    signal,
  );

  return normalizeUser(response.data);
}

export function useUsersQuery(query: UserListQuery = {}) {
  const normalizedQuery = {
    page: query.page ?? 1,
    limit: query.limit ?? 10,
    search: query.search?.trim() ?? "",
  };

  return useQuery({
    queryKey: listQueryKey(normalizedQuery),

    queryFn: ({ signal }) => fetchUsers(normalizedQuery, signal),

    placeholderData: (previous) => previous,

    staleTime: QUERY_STALE_TIMES.usersList,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.usersList,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useUserStatsQuery() {
  return useQuery({
    queryKey: STATS_KEY,

    queryFn: ({ signal }) => fetchUserStats(signal),

    staleTime: QUERY_STALE_TIMES.userStats,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.userStats,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useUserQuery(
  id: string | null | undefined,
  options?: {
    enabled?: boolean;
  },
) {
  const queryClient = useQueryClient();

  const enabled = Boolean(id) && (options?.enabled ?? true);

  return useQuery({
    queryKey: [...DETAIL_KEY, id ?? ""] as const,

    queryFn: ({ signal }) => fetchUserById(id as string, signal),

    enabled,

    staleTime: QUERY_STALE_TIMES.userDetail,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,

    initialData: () => {
      if (!id) {
        return undefined;
      }

      return findUserInListCaches(queryClient, id);
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateUserRequest) => {
      const response = await apiConnector<UserResponse>(
        "POST",
        "/users",
        payload,
      );

      return normalizeUser(response.data);
    },

    onSuccess: async (user) => {
      queryClient.setQueryData([...DETAIL_KEY, user.id], user);

      await invalidateUsersChanged(queryClient);
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      id: string;
      payload: UpdateUserRequest;
    }) => {
      const response = await apiConnector<UserResponse>(
        "PATCH",
        `/users/${variables.id}`,
        variables.payload,
      );

      return normalizeUser(response.data);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists = queryClient.getQueriesData<UserListResponse>({
        queryKey: LIST_KEY,
      });

      const previousDetails = queryClient.getQueriesData<UserResponse>({
        queryKey: DETAIL_KEY,
      });

      const existing = findUserInListCaches(queryClient, variables.id);

      const optimisticUser = buildOptimisticUser(existing, {
        id: variables.id,
        fullName: variables.payload.fullName,
        mobileNumber: variables.payload.mobileNumber,
        email: variables.payload.email,
      });

      updateListCaches(queryClient, (items) =>
        items.map((item) =>
          item.id === optimisticUser.id ? optimisticUser : item,
        ),
      );

      updateDetailCaches(queryClient, (user) =>
        user.id === variables.id ? optimisticUser : user,
      );

      return {
        previousLists,
        previousDetails,
      };
    },

    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context.previousDetails) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSuccess: async (user, variables) => {
      queryClient.setQueryData([...DETAIL_KEY, variables.id], user);

      await invalidateUsersChanged(queryClient);
    },
  });
}

export function useChangeUserPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      id: string;
      payload: ChangeUserPasswordRequest;
    }) => {
      const response = await apiConnector<UserResponse>(
        "PATCH",
        `/users/${variables.id}/password`,
        variables.payload,
      );

      return normalizeUser(response.data);
    },

    onSuccess: async (user) => {
      queryClient.setQueryData([...DETAIL_KEY, user.id], user);
    },
  });
}

export function useChangeUserRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      id: string;
      payload: ChangeUserRoleRequest;
    }) => {
      const response = await apiConnector<UserResponse>(
        "PATCH",
        `/users/${variables.id}/role`,
        variables.payload,
      );

      return normalizeUser(response.data);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists = queryClient.getQueriesData<UserListResponse>({
        queryKey: LIST_KEY,
      });

      const previousDetails = queryClient.getQueriesData<UserResponse>({
        queryKey: DETAIL_KEY,
      });

      const existing = findUserInListCaches(queryClient, variables.id);

      if (!existing) {
        return {
          previousLists,
          previousDetails,
        };
      }

      const optimisticUser = buildOptimisticUser(existing, {
        id: variables.id,
        role: variables.payload.role,
      });

      updateListCaches(queryClient, (items) =>
        items.map((item) => (item.id === variables.id ? optimisticUser : item)),
      );

      updateDetailCaches(queryClient, (user) =>
        user.id === variables.id ? optimisticUser : user,
      );

      return {
        previousLists,
        previousDetails,
      };
    },

    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context.previousDetails) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSettled: async () => {
      await invalidateUsersChanged(queryClient);
    },
  });
}

export function useArchiveUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiConnector<UserResponse>(
        "PATCH",
        `/users/${id}/archive`,
      );

      return normalizeUser(response.data);
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists = queryClient.getQueriesData<UserListResponse>({
        queryKey: LIST_KEY,
      });

      const previousDetails = queryClient.getQueriesData<UserResponse>({
        queryKey: DETAIL_KEY,
      });

      const existing = findUserInListCaches(queryClient, id);

      if (!existing) {
        return {
          previousLists,
          previousDetails,
        };
      }

      const optimisticUser = buildOptimisticUser(existing, {
        id,
        status: "inactive",
      });

      updateListCaches(queryClient, (items) =>
        items.map((item) => (item.id === id ? optimisticUser : item)),
      );

      updateDetailCaches(queryClient, (user) =>
        user.id === id ? optimisticUser : user,
      );

      return {
        previousLists,
        previousDetails,
      };
    },

    onError: (_error, _id, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context.previousDetails) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSettled: async () => {
      await invalidateUsersChanged(queryClient);
    },
  });
}

export function useRestoreUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiConnector<UserResponse>(
        "PATCH",
        `/users/${id}/restore`,
      );

      return normalizeUser(response.data);
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists = queryClient.getQueriesData<UserListResponse>({
        queryKey: LIST_KEY,
      });

      const previousDetails = queryClient.getQueriesData<UserResponse>({
        queryKey: DETAIL_KEY,
      });

      const existing = findUserInListCaches(queryClient, id);

      if (!existing) {
        return {
          previousLists,
          previousDetails,
        };
      }

      const optimisticUser = buildOptimisticUser(existing, {
        id,
        status: "active",
      });

      updateListCaches(queryClient, (items) =>
        items.map((item) => (item.id === id ? optimisticUser : item)),
      );

      updateDetailCaches(queryClient, (user) =>
        user.id === id ? optimisticUser : user,
      );

      return {
        previousLists,
        previousDetails,
      };
    },

    onError: (_error, _id, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context.previousDetails) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    onSettled: async () => {
      await invalidateUsersChanged(queryClient);
    },
  });
}
