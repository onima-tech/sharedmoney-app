import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

type IdleHost = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Stay false until the browser is idle so profile-only visits can paint
 * before groups, rates, and notification work starts.
 * Pass false to resolve on the first render.
 */
export function useDeferUntilIdle(defer: boolean): boolean {
  const [ready, setReady] = useState(() => !defer);

  useEffect(() => {
    if (!defer) {
      setReady(true);
      return;
    }
    if (ready) return;

    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    const host = globalThis as IdleHost;
    if (typeof host.requestIdleCallback === "function") {
      const id = host.requestIdleCallback(markReady, { timeout: 1500 });
      return () => {
        cancelled = true;
        host.cancelIdleCallback?.(id);
      };
    }

    const task = InteractionManager.runAfterInteractions(markReady);
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [defer, ready]);

  return ready;
}
