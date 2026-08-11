"use client";

import { useEffect } from "react";
import type { FieldErrors } from "@/domain/validate";

/**
 * Sends the caret to the first field the Server Action rejected. Field ids match
 * their error keys (`step`, `steps.2.pic`, …), so the lookup needs no map. A
 * whole-form error has no field to land on and is left to its own `role="alert"`.
 */
export function useErrorFocus(errors: FieldErrors) {
  useEffect(() => {
    const first = Object.keys(errors).find((key) => key !== "form");
    if (!first) return;
    const field = document.getElementById(first);
    if (!(field instanceof HTMLElement)) return;
    field.focus({ preventScroll: true });
    // Instant, not smooth: this is a jump to a problem, not a flourish, and it
    // has to behave the same for someone who asked for less motion.
    field.scrollIntoView({ block: "center" });
  }, [errors]);
}
