import { Minus, Plus } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { photoAvatar } from "@/lib/avatar-images";
import {
  clampOffset,
  coverScale,
  initialOffset,
  type Offset,
  sourceRect,
  zoomAround,
} from "@/lib/avatars";

/** The circle's size on screen, in CSS pixels. */
export const CROP_VIEWPORT = 240;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const KEY_STEP = 10;

interface AvatarPhotoCropperProps {
  file: File;
  /** Called with the cropped avatar as a JPEG data URL. */
  onDone: (avatar: string) => void;
  onCancel: () => void;
}

/**
 * Frames a photo in the avatar circle. Touch first: drag with one finger to move it,
 * pinch to zoom; the zoom buttons and slider do the same for a mouse, and the arrow
 * keys move it from a keyboard.
 */
export function AvatarPhotoCropper({
  file,
  onDone,
  onCancel,
}: AvatarPhotoCropperProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Active pointers, for one-finger drag and two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    offset: Offset;
    zoom: number;
    x: number;
    y: number;
    distance: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const scale = natural
    ? coverScale(natural.w, natural.h, CROP_VIEWPORT, zoom)
    : 1;

  const onLoad = () => {
    const image = imageRef.current;
    if (!image || !image.naturalWidth || !image.naturalHeight) {
      setFailed(true);
      return;
    }
    const size = { w: image.naturalWidth, h: image.naturalHeight };
    setNatural(size);
    setZoom(MIN_ZOOM);
    setOffset(initialOffset(size.w, size.h, CROP_VIEWPORT, MIN_ZOOM));
  };

  const changeZoom = (next: number) => {
    if (!natural) return;
    const bounded = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setOffset((current) =>
      zoomAround(current, natural.w, natural.h, CROP_VIEWPORT, zoom, bounded),
    );
    setZoom(bounded);
  };

  const move = (next: Offset) => {
    if (!natural) return;
    setOffset(clampOffset(next, natural.w, natural.h, CROP_VIEWPORT, scale));
  };

  const startGesture = () => {
    const points = [...pointers.current.values()];
    const [a, b] = points;
    gesture.current = {
      offset,
      zoom,
      x: a?.x ?? 0,
      y: a?.y ?? 0,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLFieldSetElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    startGesture();
  };

  const onPointerMove = (event: PointerEvent<HTMLFieldSetElement>) => {
    if (
      !pointers.current.has(event.pointerId) ||
      !gesture.current ||
      !natural
    ) {
      return;
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()];
    const start = gesture.current;
    if (points.length >= 2 && start.distance > 0) {
      const [a, b] = points;
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / start.distance;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * ratio));
      setOffset(
        zoomAround(
          start.offset,
          natural.w,
          natural.h,
          CROP_VIEWPORT,
          start.zoom,
          next,
        ),
      );
      setZoom(next);
      return;
    }
    move({
      x: start.offset.x + (event.clientX - start.x),
      y: start.offset.y + (event.clientY - start.y),
    });
  };

  const onPointerEnd = (event: PointerEvent<HTMLFieldSetElement>) => {
    pointers.current.delete(event.pointerId);
    // The remaining finger, if any, carries on from where the photo is now.
    startGesture();
    if (pointers.current.size === 0) gesture.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    const step: Record<string, Offset> = {
      ArrowLeft: { x: -KEY_STEP, y: 0 },
      ArrowRight: { x: KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEY_STEP },
      ArrowDown: { x: 0, y: KEY_STEP },
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    move({ x: offset.x + delta.x, y: offset.y + delta.y });
  };

  const save = () => {
    const image = imageRef.current;
    if (!image || !natural) return;
    try {
      onDone(photoAvatar(image, sourceRect(offset, scale, CROP_VIEWPORT)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be used");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {failed ? (
        <p role="alert" className="text-sm text-destructive text-center">
          This photo could not be opened. Try a JPEG or PNG; iPhone photos open
          in Safari.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          Drag the photo to move it and pinch or use the buttons to zoom.
        </p>
      )}
      <fieldset
        aria-label="Photo position. Drag, or use the arrow keys, to move it."
        tabIndex={failed ? -1 : 0}
        className="relative m-0 min-w-0 overflow-hidden rounded-full border-0 bg-muted p-0 touch-none select-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        {src && (
          <img
            ref={imageRef}
            src={src}
            alt=""
            data-testid="crop-photo"
            draggable={false}
            onLoad={onLoad}
            onError={() => setFailed(true)}
            className="absolute max-w-none pointer-events-none"
            style={
              natural
                ? {
                    left: offset.x,
                    top: offset.y,
                    width: natural.w * scale,
                    height: natural.h * scale,
                  }
                : { visibility: "hidden" }
            }
          />
        )}
      </fieldset>

      {!failed && (
        <div className="flex w-full max-w-xs items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Zoom out"
            disabled={!natural || zoom <= MIN_ZOOM}
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="range"
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            disabled={!natural}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="h-11 flex-1 accent-primary"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Zoom in"
            disabled={!natural || zoom >= MAX_ZOOM}
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        {!failed && (
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!natural}
            onClick={save}
          >
            Use this photo
          </Button>
        )}
      </div>
    </div>
  );
}
