/**
 * The tracker's drawn icons. One 16-unit grid, one 1.6 stroke, round caps and
 * joins, `currentColor` throughout — so every glyph reads as the same hand and
 * inherits the colour of the control it sits in.
 *
 * They are decoration next to a label and pure decoration on their own: each is
 * `aria-hidden`, and every icon-only control names itself with `aria-label`.
 */

interface IconProps {
  /** Rendered size in px. Defaults suit a table row; pagers pass their own. */
  size?: number;
  className?: string;
}

function Icon({
  size = 15,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.1 2.6a1.6 1.6 0 0 1 2.3 2.3L6 12.3l-3 .7.7-3z" />
      <path d="M9.9 3.8l2.3 2.3" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.8 4.2h10.4" />
      <path d="M6.2 4.2V2.9h3.6v1.3" />
      <path d="M4.1 4.2l.6 8.2a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.6-8.2" />
      <path d="M6.7 6.8v3.9M9.3 6.8v3.9" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3.2L5.2 8l4.8 4.8" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.2L10.8 8 6 12.8" />
    </Icon>
  );
}

/** The empty state's mark: a search that came back with nothing in it. */
export function NoResultsIcon({ size = 30, className = "" }: IconProps) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="13.5" cy="13.5" r="8.5" />
      <path d="M19.8 19.8L27 27" />
      <path d="M10.4 13.5h6.2" />
    </svg>
  );
}

/**
 * The sort affordance, as one glyph with three states. Both chevrons sit at low
 * contrast until the column is the one doing the sorting, and then the chevron
 * pointing the way the rows run takes the accent.
 */
export function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  const up = active && direction === "asc";
  const down = active && direction === "desc";
  // Light enough to stay subordinate to the label, dark enough to clear 3:1
  // against the header fill — this is an affordance, not decoration.
  const idle = "text-[oklch(64%_0.012_250)]";

  return (
    <svg
      aria-hidden
      focusable="false"
      width={9}
      height={13}
      viewBox="0 0 9 13"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path
        d="M1.6 5.1L4.5 2.2l2.9 2.9"
        className={up ? "text-accent" : idle}
        stroke="currentColor"
      />
      <path
        d="M1.6 7.9l2.9 2.9 2.9-2.9"
        className={down ? "text-accent" : idle}
        stroke="currentColor"
      />
    </svg>
  );
}
