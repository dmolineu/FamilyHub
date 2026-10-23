import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  CreateRecipeRequest,
  ImportRecipeRequest,
  RecipeDetailApiResponse,
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

  /** Adds the bundled starter recipes the family does not have yet. */
  addStarterPack(): Promise<ApiResponse<StarterRecipesResponse>> {
    return httpClient.post<ApiResponse<StarterRecipesResponse>>(
      "/recipes/starter-pack",
    );
  },
};
