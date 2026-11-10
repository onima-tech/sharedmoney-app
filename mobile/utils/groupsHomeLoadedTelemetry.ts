/**
 * Trustworthy groups_home_loaded timing.
 *
 * Historical bug: a mount effect reset Date.now() and the ready effect then
 * logged duration_ms 0 whenever the groups query was already cached. The start
 * stamp has to be when this home visit began (app open, sign-in, terms done,
 * or a return to Home). The end stamp is the commit that paints the list.
 */

export interface GroupsHomeLoadClock {
  startedAtMs: number;
  userId: string | null;
  sawLoggedOut: boolean;
  route: string;
  termsBlocking: boolean;
}

export interface GroupsHomeLoadClockUpdate {
  nowMs: number;
  userId: string | null;
  authLoading: boolean;
  route: string;
  termsBlocking: boolean;
}

export interface GroupsHomeLoadedTiming {
  duration_ms: number;
  from_cache: boolean;
}

export function createGroupsHomeLoadClock(
  nowMs: number,
  route = "groups",
): GroupsHomeLoadClock {
  return {
    startedAtMs: nowMs,
    userId: null,
    sawLoggedOut: false,
    route,
    termsBlocking: false,
  };
}

/**
 * Advance the home-visit clock. Passing time while Home stays up does not
 * move the stamp — that reset was the 0 ms bug.
 */
export function updateGroupsHomeLoadClock(
  clock: GroupsHomeLoadClock,
  update: GroupsHomeLoadClockUpdate,
): GroupsHomeLoadClock {
  const authSettledLoggedOut = !update.authLoading && update.userId == null;
  const sawLoggedOut = clock.sawLoggedOut || authSettledLoggedOut;
  const previousUserId = authSettledLoggedOut ? null : clock.userId;

  let startedAtMs = clock.startedAtMs;
  let userId = previousUserId;

  if (update.userId != null && update.userId !== previousUserId) {
    // Cold start: session restores without a logged-out screen, so the wait
    // includes bootstrap. A real sign-in starts when the session appears.
    const keepAppStart = clock.userId == null && !sawLoggedOut;
    userId = update.userId;
    if (!keepAppStart) {
      startedAtMs = update.nowMs;
    }
  }

  const signedIn = update.userId != null;
  if (signedIn && update.route === "groups" && clock.route !== "groups") {
    startedAtMs = update.nowMs;
  }
  if (signedIn && clock.termsBlocking && !update.termsBlocking) {
    startedAtMs = update.nowMs;
  }

  const next: GroupsHomeLoadClock = {
    startedAtMs,
    userId,
    sawLoggedOut: update.userId != null ? false : sawLoggedOut,
    route: update.route,
    termsBlocking: update.termsBlocking,
  };

  if (
    next.startedAtMs === clock.startedAtMs &&
    next.userId === clock.userId &&
    next.sawLoggedOut === clock.sawLoggedOut &&
    next.route === clock.route &&
    next.termsBlocking === clock.termsBlocking
  ) {
    return clock;
  }
  return next;
}

export function resolveGroupsHomeLoadedTiming(input: {
  startedAtMs: number;
  renderedAtMs: number;
  /** True if the groups query was observed loading with no rows this visit. */
  sawInitialLoading: boolean;
}): GroupsHomeLoadedTiming {
  return {
    duration_ms: Math.max(0, Math.round(input.renderedAtMs - input.startedAtMs)),
    from_cache: !input.sawInitialLoading,
  };
}
