"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BRANCHES, BRANCH_GROUPS, isBranchCode, type Branch } from "@/domain/branches";

interface BranchSelectProps {
  /** Name of the hidden input, so a plain form post still carries the value. */
  name: string;
  id: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  required?: boolean;
  disabled?: boolean;
}

interface Option extends Branch {
  region: string;
}

const OPTIONS: readonly Option[] = BRANCH_GROUPS.flatMap((group) =>
  group.branches.map((branch) => ({ ...branch, region: group.region })),
);

const BY_CODE = new Map(OPTIONS.map((option) => [option.code, option]));

/** Roughly eight rows; enough to scan without covering the field that filters it. */
const MAX_LIST_HEIGHT = 260;

/**
 * City names already carry an em dash ("Surakarta — Adi Soemarmo"), so the code is
 * joined with a middot instead of a second one.
 */
const label = (option: Option) => `${option.code} · ${option.city}`;

/**
 * Rank matches so typing "CGK" puts Soekarno-Hatta first rather than burying it
 * under every airport whose description happens to contain those letters. A code
 * that starts with the query beats one that merely contains it, which beats a hit
 * in the city or hub name.
 */
function score(option: Option, query: string): number {
  const code = option.code.toLowerCase();
  const city = option.city.toLowerCase();
  const region = option.region.toLowerCase();

  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (city.startsWith(query)) return 2;
  if (code.includes(query)) return 3;
  if (city.includes(query)) return 4;
  if (region.includes(query)) return 5;
  return -1;
}

function search(query: string): readonly Option[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return OPTIONS;

  return OPTIONS.map((option) => ({ option, rank: score(option, trimmed) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.option);
}

/**
 * Type-ahead picker over the hub branches.
 *
 * A native `<select>` holds them all but can only be searched by the browser's own
 * first-letters jump, which is useless when the thing you know is "Surabaya" and the
 * list is ordered by hub. This keeps the native element's job — a hidden input
 * still carries the value, so the form posts the same way — and puts a filter in
 * front of it.
 */
export function BranchSelect({
  name,
  id,
  defaultValue = "",
  onChange,
  required = false,
  disabled = false,
}: BranchSelectProps) {
  const [code, setCode] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    flipped: boolean;
  } | null>(null);

  const matches = useMemo(() => (open ? search(query) : OPTIONS), [open, query]);
  const selected = BY_CODE.get(code);
  /**
   * Hub headings only make sense on the unfiltered list, which is in hub order. A
   * search is ranked by how well each station matches, so the hubs interleave — the
   * hub is put on the row itself there instead.
   */
  const grouped = query.trim() === "";

  /**
   * The list is portalled to `document.body` and positioned against the field.
   *
   * Inside the edit dialog the form body scrolls, and an absolutely positioned list
   * is clipped by it — the picker showed three stations and a sliced fourth. Taking
   * the list out of that scroll container is what makes it whole, at the cost of
   * having to place it by hand.
   */
  const place = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const flipped = below < MAX_LIST_HEIGHT + 8 && rect.top > below;
    setAnchor({
      left: rect.left,
      top: flipped ? rect.top : rect.bottom,
      width: rect.width,
      flipped,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // `true` so the field is re-measured when any ancestor scrolls, the dialog body
    // included, rather than only the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Clicking anywhere else closes the list and abandons whatever was half-typed.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      // The list is portalled out of this subtree, so it has to be asked about
      // separately — otherwise the first press on an option closes the list and
      // the click never lands.
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: Option) {
    setCode(option.code);
    onChange?.(option.code);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = current + step;
        if (next < 0) return matches.length - 1;
        if (next >= matches.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = matches[active];
      if (option) choose(option);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  const text = open ? query : selected ? label(selected) : "";
  const placeholder = selected
    ? label(selected)
    : isBranchCode(code)
      ? code
      : "Ketik kode atau nama kota…";

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={code} />

      <div ref={fieldRef} className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          // The real value lives in the hidden input; this one only ever holds a
          // label or a search term, so it must not be submitted or autofilled.
          value={text}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(Math.max(0, matches.findIndex((o) => o.code === code)));
          }}
          onKeyDown={onKeyDown}
          className="field w-full pr-9"
          data-testid={`${id}-input`}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-faint"
        >
          <svg width="11" height="7" viewBox="0 0 11 7" fill="none">
            <path
              d="M1 1l4.5 4.5L10 1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* Mirrors the value for constraint validation, so an empty branch is caught
          by the browser before the form is ever posted. */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={code}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}

      {open && anchor
        ? createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Daftar cabang"
          style={{
            position: "fixed",
            left: anchor.left,
            width: anchor.width,
            maxHeight: MAX_LIST_HEIGHT,
            ...(anchor.flipped
              ? { bottom: window.innerHeight - anchor.top + 4 }
              : { top: anchor.top + 4 }),
          }}
          className="z-50 overflow-y-auto rounded-[8px] border border-line-strong bg-surface py-1 shadow-[0_4px_24px_-4px_oklch(0%_0_0_/_0.18)]"
          data-testid={`${id}-list`}
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-faint">
              Tidak ada cabang yang cocok.
            </li>
          ) : (
            matches.map((option, index) => (
              <li key={option.code}>
                {grouped && option.region !== matches[index - 1]?.region ? (
                  <p
                    role="presentation"
                    className="sticky top-0 bg-surface px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {option.region}
                  </p>
                ) : null}
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.code === code}
                  data-index={index}
                  // Pointer-down would fire before the click and steal focus first.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left ${
                    index === active ? "bg-head" : ""
                  }`}
                >
                  <span className="font-mono text-[12px] font-semibold text-ink">
                    {option.code}
                  </span>
                  <span className="truncate text-[12.5px] text-ink-mid">
                    {option.city}
                  </span>
                  {grouped ? null : (
                    <span className="ml-auto shrink-0 text-[11px] text-faint">
                      {option.region}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Total stations offered, so a caption can state it without importing the list. */
export const BRANCH_COUNT = BRANCHES.length;
