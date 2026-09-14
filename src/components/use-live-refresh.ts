"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Safety net for a websocket that is blocked by a proxy or dropped silently.
 * With the broadcast working this should never be the path that shows a change.
 */
const FALLBACK_MS = 120_000;
/** Offline mode has no Supabase to listen to, so it keeps the old poll rate. */
const POLL_ONLY_MS = 60_000;
/** One burst of imported rows fires several statements, so pings are coalesced. */
const DEBOUNCE_MS = 300;

/**
 * Refreshes the dashboard the moment the tracker changes, whether the edit came
 * from the app or straight from Google Sheets.
 *
 * The broadcast carries no row data — only the fact that something changed. The
 * refresh itself re-renders on the server, which is what applies the branch
 * filtering, so a user never receives another station's rows over the socket.
 */
export function useLiveRefresh(paused: boolean) {
  const router = useRouter();

  useEffect(() => {
    // A refresh under an open dialog would discard what the user is typing.
    if (paused) return;

    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = setTimeout(() => {
        pending = undefined;
        if (!cancelled) router.refresh();
      }, DEBOUNCE_MS);
    };

    // DATA_BACKEND=memory runs without Supabase at all; there is nothing to
    // subscribe to and constructing the client would throw.
    const live = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const supabase = live ? supabaseBrowser() : null;
    const channel = supabase
      ?.channel("iap-tracker", { config: { private: true } })
      .on("broadcast", { event: "changed" }, refresh);

    if (supabase && channel) {
      // The topic is private, so the socket has to carry the signed-in session.
      void Promise.resolve(supabase.realtime.setAuth())
        .then(() => {
          if (!cancelled) channel.subscribe();
        })
        .catch(() => {
          // Falls back to the interval below rather than breaking the dashboard.
        });
    }

    const timer = setInterval(refresh, live ? FALLBACK_MS : POLL_ONLY_MS);
    // Pings that arrived while the tab was hidden were dropped; catch up once.
    const onVisible = () => refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [router, paused]);
}
