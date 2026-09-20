import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  milkTypeAPI,
  type CreateMilkTypeRequest,
  type MilkTypeListQuery,
  type UpdateMilkTypeRequest,
} from "@/services/milk-type.service";

export const milkTypeQueryKeys = {
  all: ["milk-types"] as const,
  list: (query: MilkTypeListQuery = {}) =>
    [
      "milk-types",
      "list",
      query.page ?? 1,
      query.limit ?? 20,
      query.status ?? null,
      query.search?.trim() ?? "",
    ] as const,
  active: () => ["milk-types", "active"] as const,
  detail: (id: string) => ["milk-types", "detail", id] as const,
};

export function useMilkTypesQuery(query?: MilkTypeListQuery) {
  return useQuery({
    queryKey: milkTypeQueryKeys.list(query),
    queryFn: () => milkTypeAPI.getMilkTypes(query),
    refetchOnWindowFocus: false,
  });
}

export function useActiveMilkTypesQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: milkTypeQueryKeys.active(),
    queryFn: () => milkTypeAPI.getActiveMilkTypes(),
    enabled: options.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export function useMilkTypeQuery(id?: string) {
  return useQuery({
    queryKey: milkTypeQueryKeys.detail(id ?? ""),
    queryFn: () => milkTypeAPI.getMilkTypeById(id as string),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMilkTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMilkTypeRequest) =>
      milkTypeAPI.createMilkType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milkTypeQueryKeys.all });
      toast.success("Milk type created");
    },
  });
}

export function useUpdateMilkTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMilkTypeRequest }) =>
      milkTypeAPI.updateMilkType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milkTypeQueryKeys.all });
      toast.success("Milk type updated");
    },
  });
}

export function useArchiveMilkTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => milkTypeAPI.archiveMilkType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milkTypeQueryKeys.all });
      toast.success("Milk type archived");
    },
  });
}

export function useRestoreMilkTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => milkTypeAPI.restoreMilkType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milkTypeQueryKeys.all });
      toast.success("Milk type restored");
    },
  });
}
