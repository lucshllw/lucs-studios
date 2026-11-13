import { type Project, type Shot, shotUrl, srcSet } from "@/lib/projects";

/** Captura 4K responsiva: AVIF → WebP, 828–3840 px; telas grandes/retina recebem a 3840 (sem ampliar o original). */
export function Pic({
  project,
  shot,
  sizes,
  alt,
  className,
  imgClassName,
  eager = false,
  fallbackWidth = 1920,
}: {
  project: Project;
  shot: Shot;
  sizes: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  fallbackWidth?: number;
}) {
  const fw = shot.widths.includes(fallbackWidth) ? fallbackWidth : shot.widths[0];
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet(project, shot, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(project, shot, "webp")} sizes={sizes} />
      <img
        className={imgClassName}
        src={shotUrl(project, shot.id, fw)}
        width={shot.w}
        height={shot.h}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
