import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  CreateRecipeRequest,
  ImportRecipeRequest,
  RecipeDetailApiResponse,
  RecipePack,
  RecipesApiResponse,
  StarterRecipesResponse,
  UpdateRecipeRequest,
} from "@/lib/types";

export const recipesService = {
  getRecipes(): Promise<RecipesApiResponse> {
    return httpClient.get<RecipesApiResponse>("/recipes");
  },

  getRecipe(id: string): Promise<RecipeDetailApiResponse> {
    return httpClient.get<RecipeDetailApiResponse>(`/recipes/${id}`);
  },

  createRecipe(request: CreateRecipeRequest): Promise<RecipeDetailApiResponse> {
    return httpClient.post<RecipeDetailApiResponse>("/recipes", request);
  },

  updateRecipe(
    id: string,
    request: UpdateRecipeRequest,
  ): Promise<RecipeDetailApiResponse> {
    return httpClient.patch<RecipeDetailApiResponse>(`/recipes/${id}`, request);
  },

  importRecipe(request: ImportRecipeRequest): Promise<RecipeDetailApiResponse> {
    return httpClient.post<RecipeDetailApiResponse>("/recipes/import", request);
  },

  /** The bundled recipe packs. */
  listPacks(): Promise<ApiResponse<RecipePack[]>> {
    return httpClient.get<ApiResponse<RecipePack[]>>("/recipes/packs");
  },

  /** Adds a pack's recipes the family does not have yet; safe to repeat. */
  addPack(id: string): Promise<ApiResponse<StarterRecipesResponse>> {
    return httpClient.post<ApiResponse<StarterRecipesResponse>>(
      `/recipes/packs/${encodeURIComponent(id)}`,
    );
  },
};
