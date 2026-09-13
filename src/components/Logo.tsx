import Image from "next/image";

/**
 * The Gapura Angkasa mark, in place of the company name set as text.
 *
 * Intrinsic size is the file's own 1052×569, so Next can serve a correctly sized
 * image; `height` here is the rendered height and the width follows the aspect
 * ratio. The wordmark already reads "Gapura Airport Services", so the surrounding
 * markup never repeats it — the alt text carries it for anyone not seeing it.
 */
export function Logo({
  height = 34,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-gapura.webp"
      alt="PT Gapura Angkasa — Airport Services"
      width={1052}
      height={569}
      priority={priority}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
