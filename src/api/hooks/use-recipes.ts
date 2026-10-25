import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesService } from "@/api/services";
import type {
  CreateRecipeRequest,
  ImportRecipeRequest,
  RecipeDetailApiResponse,
  UpdateRecipeRequest,
} from "@/lib/types";

export const recipesKeys = {
  all: ["recipes"] as const,
  list: () => [...recipesKeys.all, "list"] as const,
  detail: (id: string) => [...recipesKeys.all, "detail", id] as const,
  packs: () => [...recipesKeys.all, "packs"] as const,
};

function cacheRecipeDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  response: RecipeDetailApiResponse,
) {
  queryClient.setQueryData(recipesKeys.detail(response.data.id), response);
  queryClient.invalidateQueries({ queryKey: recipesKeys.list() });
}

export function useRecipes() {
  return useQuery({
    queryKey: recipesKeys.list(),
    queryFn: recipesService.getRecipes,
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: recipesKeys.detail(id ?? "none"),
    queryFn: () => recipesService.getRecipe(id!),
    enabled: id !== null,
  });
}

export function useCreateRecipe(callbacks?: {
  onSuccess?: (data: RecipeDetailApiResponse) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateRecipeRequest) =>
      recipesService.createRecipe(request),
    onSuccess: (response) => {
      cacheRecipeDetail(queryClient, response);
      callbacks?.onSuccess?.(response);
    },
  });
}

/** The bundled recipe packs; fetched only while the packs sheet is open. */
export function useRecipePacks(enabled = true) {
  return useQuery({
    queryKey: recipesKeys.packs(),
    queryFn: async () => (await recipesService.listPacks()).data,
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

/** Adds a pack's missing recipes and refreshes the library list. */
export function useAddRecipePack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipesService.addPack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipesKeys.list() });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateRecipeRequest) =>
      recipesService.updateRecipe(id, request),
    onSuccess: (response) => {
      cacheRecipeDetail(queryClient, response);
    },
  });
}

export function useImportRecipe(callbacks?: {
  onSuccess?: (data: RecipeDetailApiResponse) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ImportRecipeRequest) =>
      recipesService.importRecipe(request),
    onSuccess: (response) => {
      cacheRecipeDetail(queryClient, response);
      callbacks?.onSuccess?.(response);
    },
  });
}
