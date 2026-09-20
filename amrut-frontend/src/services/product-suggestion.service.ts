import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { invalidateProductSuggestionsChanged } from "./utils/query-invalidation";
import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";
import { apiConnector } from "./utils/apiConnector";

export type ProductSuggestionStatus = "active" | "inactive";

export interface ProductSuggestion {
  id: string;
  name: string;
  displayOrder: number;
  status: ProductSuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ProductSuggestionListResponse {
  items: ProductSuggestion[];
  pageInfo: PageInfo;
}

export interface ProductSuggestionActiveResponse {
  items: ProductSuggestion[];
}

export interface ProductSuggestionReorderResponse {
  items: ProductSuggestion[];
}

export interface ProductSuggestionListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateProductSuggestionRequest {
  name: string;
  displayOrder?: number;
}

export interface UpdateProductSuggestionRequest {
  name?: string;
  displayOrder?: number;
}

export interface ReorderProductSuggestionRequest {
  orderedIds: string[];
}

const ROOT_KEY = ["product-suggestions"] as const;

const LIST_KEY = [...ROOT_KEY, "list"] as const;

const ACTIVE_KEY = [...ROOT_KEY, "active"] as const;

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

function listQueryKey(query: ProductSuggestionListQuery = {}) {
  return [
    ...LIST_KEY,
    {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      search: query.search?.trim() ?? "",
    },
  ] as const;
}

function sortItems(items: ProductSuggestion[]) {
  return [...items].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function replaceItem(items: ProductSuggestion[], nextItem: ProductSuggestion) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function upsertItem(items: ProductSuggestion[], nextItem: ProductSuggestion) {
  const exists = items.some((item) => item.id === nextItem.id);

  if (exists) {
    return replaceItem(items, nextItem);
  }

  return [...items, nextItem];
}

function optimisticReorder(items: ProductSuggestion[], orderedIds: string[]) {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));

  return [...items]
    .sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);

      if (aRank === undefined && bRank === undefined) {
        return a.displayOrder - b.displayOrder;
      }

      if (aRank === undefined) {
        return 1;
      }

      if (bRank === undefined) {
        return -1;
      }

      return aRank - bRank;
    })
    .map((item, index) => ({
      ...item,
      displayOrder: index,
    }));
}

function updateListCaches(
  queryClient: QueryClient,
  updater: (items: ProductSuggestion[]) => ProductSuggestion[],
) {
  const cached = queryClient.getQueriesData<ProductSuggestionListResponse>({
    queryKey: LIST_KEY,
  });

  for (const [queryKey, oldData] of cached) {
    if (!oldData) {
      continue;
    }

    queryClient.setQueryData<ProductSuggestionListResponse>(queryKey, {
      ...oldData,
      items: updater(oldData.items),
    });
  }
}

function updateActiveCache(
  queryClient: QueryClient,
  updater: (items: ProductSuggestion[]) => ProductSuggestion[],
) {
  queryClient.setQueryData<ProductSuggestionActiveResponse>(
    ACTIVE_KEY,
    (old) => {
      if (!old) {
        return old;
      }

      return {
        ...old,
        items: updater(old.items),
      };
    },
  );
}

function findProductInListCaches(queryClient: QueryClient, id: string) {
  const cached = queryClient.getQueriesData<ProductSuggestionListResponse>({
    queryKey: LIST_KEY,
  });

  for (const [, data] of cached) {
    const found = data?.items.find((item) => item.id === id);

    if (found) {
      return found;
    }
  }

  const active =
    queryClient.getQueryData<ProductSuggestionActiveResponse>(ACTIVE_KEY);

  return active?.items.find((item) => item.id === id);
}

function normalizeProductSuggestion(productSuggestion: ProductSuggestion) {
  return {
    ...productSuggestion,
    createdAt: new Date(productSuggestion.createdAt).toISOString(),
    updatedAt: new Date(productSuggestion.updatedAt).toISOString(),
  };
}

async function fetchProductSuggestions(
  query: ProductSuggestionListQuery = {},
  signal?: AbortSignal,
): Promise<ProductSuggestionListResponse> {
  const response = await apiConnector<ProductSuggestionListResponse>(
    "GET",
    "/product-suggestions",
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
    items: response.data.items.map(normalizeProductSuggestion),
  };
}

async function fetchActiveProductSuggestions(
  signal?: AbortSignal,
): Promise<ProductSuggestionActiveResponse> {
  const response = await apiConnector<ProductSuggestionActiveResponse>(
    "GET",
    "/product-suggestions/active",
    undefined,
    undefined,
    undefined,
    signal,
  );

  return {
    ...response.data,
    items: response.data.items.map(normalizeProductSuggestion),
  };
}

export function useProductSuggestionsQuery(
  query: ProductSuggestionListQuery = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: listQueryKey(query),

    queryFn: ({ signal }) => fetchProductSuggestions(query, signal),

    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,

    staleTime: QUERY_STALE_TIMES.productSuggestionsList,
    gcTime: QUERY_GC_TIMES.long,
    refetchInterval: QUERY_REFETCH_INTERVALS.productSuggestionsList,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useActiveProductSuggestionsQuery() {
  return useQuery({
    queryKey: ACTIVE_KEY,

    queryFn: ({ signal }) => fetchActiveProductSuggestions(signal),

    staleTime: QUERY_STALE_TIMES.activeProductSuggestions,
    gcTime: QUERY_GC_TIMES.long,
    refetchInterval: QUERY_REFETCH_INTERVALS.activeProductSuggestions,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useCreateProductSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductSuggestionRequest) => {
      const response = await apiConnector<ProductSuggestion>(
        "POST",
        "/product-suggestions",
        payload,
      );

      return normalizeProductSuggestion(response.data);
    },

    onSuccess: async () => {
      await invalidateProductSuggestionsChanged(queryClient);
    },
  });
}

export function useUpdateProductSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      id: string;
      payload: UpdateProductSuggestionRequest;
    }) => {
      const response = await apiConnector<ProductSuggestion>(
        "PATCH",
        `/product-suggestions/${variables.id}`,
        variables.payload,
      );

      return normalizeProductSuggestion(response.data);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists =
        queryClient.getQueriesData<ProductSuggestionListResponse>({
          queryKey: LIST_KEY,
        });

      const previousActive =
        queryClient.getQueryData<ProductSuggestionActiveResponse>(ACTIVE_KEY);

      const existing = findProductInListCaches(queryClient, variables.id);

      if (!existing) {
        return {
          previousLists,
          previousActive,
        };
      }

      const optimisticItem = normalizeProductSuggestion({
        ...existing,
        ...variables.payload,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      });

      updateListCaches(queryClient, (items) =>
        sortItems(replaceItem(items, optimisticItem)),
      );

      updateActiveCache(queryClient, (items) =>
        optimisticItem.status !== "active"
          ? items.filter((item) => item.id !== optimisticItem.id)
          : sortItems(upsertItem(items, optimisticItem)),
      );

      return {
        previousLists,
        previousActive,
      };
    },

    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      queryClient.setQueryData(ACTIVE_KEY, context.previousActive);
    },

    onSettled: async () => {
      await invalidateProductSuggestionsChanged(queryClient);
    },
  });
}

export function useArchiveProductSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiConnector<ProductSuggestion>(
        "PATCH",
        `/product-suggestions/${id}/archive`,
      );

      return normalizeProductSuggestion(response.data);
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists =
        queryClient.getQueriesData<ProductSuggestionListResponse>({
          queryKey: LIST_KEY,
        });

      const previousActive =
        queryClient.getQueryData<ProductSuggestionActiveResponse>(ACTIVE_KEY);

      updateListCaches(queryClient, (items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "inactive",
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      updateActiveCache(queryClient, (items) =>
        items.filter((item) => item.id !== id),
      );

      return {
        previousLists,
        previousActive,
      };
    },

    onError: (_error, _id, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      queryClient.setQueryData(ACTIVE_KEY, context.previousActive);
    },

    onSettled: async () => {
      await invalidateProductSuggestionsChanged(queryClient);
    },
  });
}

export function useRestoreProductSuggestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiConnector<ProductSuggestion>(
        "PATCH",
        `/product-suggestions/${id}/restore`,
      );

      return normalizeProductSuggestion(response.data);
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists =
        queryClient.getQueriesData<ProductSuggestionListResponse>({
          queryKey: LIST_KEY,
        });

      const previousActive =
        queryClient.getQueryData<ProductSuggestionActiveResponse>(ACTIVE_KEY);

      const existing = findProductInListCaches(queryClient, id);

      if (!existing) {
        return {
          previousLists,
          previousActive,
        };
      }

      const optimisticItem = normalizeProductSuggestion({
        ...existing,
        status: "active",
        updatedAt: new Date().toISOString(),
      });

      updateListCaches(queryClient, (items) =>
        sortItems(replaceItem(items, optimisticItem)),
      );

      updateActiveCache(queryClient, (items) =>
        sortItems(upsertItem(items, optimisticItem)),
      );

      return {
        previousLists,
        previousActive,
      };
    },

    onError: (_error, _id, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      queryClient.setQueryData(ACTIVE_KEY, context.previousActive);
    },

    onSettled: async () => {
      await invalidateProductSuggestionsChanged(queryClient);
    },
  });
}

export function useReorderProductSuggestionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReorderProductSuggestionRequest) => {
      const response = await apiConnector<ProductSuggestionReorderResponse>(
        "PATCH",
        "/product-suggestions/reorder",
        payload,
      );

      return {
        ...response.data,
        items: response.data.items.map(normalizeProductSuggestion),
      };
    },

    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({
        queryKey: ROOT_KEY,
      });

      const previousLists =
        queryClient.getQueriesData<ProductSuggestionListResponse>({
          queryKey: LIST_KEY,
        });

      const previousActive =
        queryClient.getQueryData<ProductSuggestionActiveResponse>(ACTIVE_KEY);

      updateListCaches(queryClient, (items) =>
        optimisticReorder(items, orderedIds),
      );

      updateActiveCache(queryClient, (items) =>
        optimisticReorder(items, orderedIds),
      );

      return {
        previousLists,
        previousActive,
      };
    },

    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      queryClient.setQueryData(ACTIVE_KEY, context.previousActive);
    },

    onSettled: async () => {
      await invalidateProductSuggestionsChanged(queryClient);
    },
  });
}
