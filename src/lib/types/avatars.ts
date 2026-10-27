import type { ApiResponse } from "./api-response";

/** One character a member can pick; its picture is an inline PNG, JPEG or WebP. */
export interface AvatarCharacter {
  key: string;
  name: string;
  /** Absent means the group named after the pack. */
  group?: string;
  image: string;
}

/** A `.familyavatars.json` file, exactly as imported. */
export interface AvatarPackDocument {
  version: 1;
  name: string;
  characters: AvatarCharacter[];
}

/** What Family Settings lists for a pack; the characters are fetched by id. */
export interface AvatarPackSummary {
  id: string;
  name: string;
  characterCount: number;
  groups: string[];
  sizeBytes: number;
  createdAt: string | null;
}

export type AvatarPackListResponse = ApiResponse<AvatarPackSummary[]>;
export type AvatarPackImportResponse = ApiResponse<AvatarPackSummary>;
