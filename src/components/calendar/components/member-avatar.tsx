import { useState } from "react";
import { BuiltInAvatarArt } from "@/components/shared/built-in-avatar-art";
import { parseAvatar } from "@/lib/avatars";
import { memberColor } from "@/lib/member-color";
import type { FamilyColor } from "@/lib/types";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "w-5 h-5 text-[8px]",
  md: "w-6 h-6 text-[9px]",
  lg: "w-8 h-8 text-xs",
} as const;

interface MemberAvatarProps {
  name: string;
  color: FamilyColor;
  /** The member's stored avatar; without one (or if it fails to load) the initial shows. */
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  variant?: "filled" | "ring";
  /** Extra classes; sizing classes here win over `size`. */
  className?: string;
}

/**
 * A member's circle: their photo or character, a built-in picture on their colour, or
 * their initial on their colour. Decorative wherever the name is shown beside it.
 */
export function MemberAvatar({
  name,
  color,
  avatarUrl,
  size = "md",
  variant = "filled",
  className,
}: MemberAvatarProps) {
  const colors = memberColor(color);
  const initial = name.charAt(0).toUpperCase();
  const avatar = parseAvatar(avatarUrl);
  // Remembers which picture failed, so a different one gets its own chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = avatar.kind === "image" ? avatar.src : null;
  const showImage = imageSrc !== null && failedSrc !== imageSrc;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0 overflow-hidden",
        sizeClasses[size],
        variant === "filled"
          ? `${colors.bg} text-white`
          : `border-2 bg-transparent ${colors.text}`,
        className,
      )}
      style={
        variant === "ring"
          ? {
              borderColor: colors.hex,
            }
          : undefined
      }
    >
      {showImage ? (
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : avatar.kind === "builtin" ? (
        <BuiltInAvatarArt avatarKey={avatar.key} />
      ) : (
        initial
      )}
    </span>
  );
}
