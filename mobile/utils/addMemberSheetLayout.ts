export type AddMemberSheetMode = "chooser" | "create" | "existing";

/**
 * The method chooser has no text field. A keyboard left open by the create
 * form or the people search must be dismissed, and the sheet must not lift.
 */
export function addMemberModeDismissesKeyboard(mode: AddMemberSheetMode): boolean {
  return mode === "chooser";
}

/** Keyboard height the sheet should react to. The chooser always gets 0. */
export function keyboardHeightForAddMemberMode(
  mode: AddMemberSheetMode,
  reportedHeight: number,
): number {
  if (addMemberModeDismissesKeyboard(mode)) return 0;
  return Number.isFinite(reportedHeight) ? Math.max(0, reportedHeight) : 0;
}

const SHEET_HEIGHT_RATIO = 0.64;
const SHEET_MAX_HEIGHT = 560;
/** Ignore sub-pixel keyboard noise and treat the keyboard as closed. */
const KEYBOARD_OPEN_MIN = 1;
/**
 * screenY and the reported keyboard height can disagree by the status bar
 * or home-indicator inset. Cap the lift so a bad coordinate cannot shove
 * the sheet off the top of the window.
 */
const LIFT_FUDGE = 48;

export type AddMemberSheetFrame = {
  height: number;
  marginBottom: number;
  keyboardOpen: boolean;
};

/** Resting Add people sheet height, before the keyboard opens. */
export function restingAddMemberSheetHeight(windowHeight: number): number {
  return Math.min(Math.max(0, windowHeight) * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT);
}

/**
 * How far the sheet must move up so its bottom sits on the keyboard.
 *
 * `keyboardScreenY` is the top of the keyboard in window coordinates
 * (`KeyboardEvent.endCoordinates.screenY`). When Android `adjustResize`
 * has already shrunk the window, that top is at or below the window bottom
 * and the lift is 0 — the shorter window is the space above the keyboard.
 * A non-positive `keyboardScreenY` is a known bad Android payload; fall
 * back to the reported height unless the window already resized.
 */
export function keyboardLift(input: {
  windowHeight: number;
  restingWindowHeight: number;
  keyboardHeight: number;
  keyboardScreenY: number | null;
}): number {
  const keyboardHeight = Number.isFinite(input.keyboardHeight)
    ? Math.max(0, input.keyboardHeight)
    : 0;
  if (keyboardHeight < KEYBOARD_OPEN_MIN) return 0;

  const screenY = input.keyboardScreenY;
  if (screenY == null || !Number.isFinite(screenY) || screenY <= 0) {
    const shrunkBy = input.restingWindowHeight - input.windowHeight;
    if (shrunkBy >= keyboardHeight * 0.5) return 0;
    return keyboardHeight;
  }

  const overlap = input.windowHeight - screenY;
  if (overlap <= 0) return 0;
  const shrunkBy = input.restingWindowHeight - input.windowHeight;
  // The window is still full-size, so a short overlap is a coordinate
  // mismatch (status bar / window origin). Trust the reported height too.
  const lift = shrunkBy >= keyboardHeight * 0.5
    ? overlap
    : Math.max(overlap, keyboardHeight);
  return Math.min(lift, keyboardHeight + LIFT_FUDGE);
}

/**
 * Sheet size while Add people is open.
 *
 * Keyboard closed: the bottom sheet keeps its resting height. The existing
 * person picker stays full screen.
 * Keyboard open: the sheet fills the space above the keyboard (below the
 * top safe area for the bottom sheet) so the focused field can scroll into
 * view and the add button is not stuck under the keyboard.
 */
export function getAddMemberSheetFrame(input: {
  windowHeight: number;
  restingWindowHeight: number;
  topInset: number;
  keyboardHeight: number;
  keyboardScreenY: number | null;
  fullScreen: boolean;
}): AddMemberSheetFrame {
  const windowHeight = Math.max(0, input.windowHeight);
  const topInset = Math.max(0, input.topInset);
  const keyboardHeight = Number.isFinite(input.keyboardHeight)
    ? Math.max(0, input.keyboardHeight)
    : 0;
  const lift = keyboardLift({
    windowHeight,
    restingWindowHeight: input.restingWindowHeight,
    keyboardHeight,
    keyboardScreenY: input.keyboardScreenY,
  });
  const shrunkBy = input.restingWindowHeight - windowHeight;
  const windowShrunkForKeyboard = keyboardHeight >= KEYBOARD_OPEN_MIN &&
    shrunkBy >= Math.min(80, keyboardHeight * 0.5);
  const keyboardOpen = lift > 0 || windowShrunkForKeyboard;

  if (!keyboardOpen) {
    return {
      height: input.fullScreen
        ? windowHeight
        : restingAddMemberSheetHeight(windowHeight),
      marginBottom: 0,
      keyboardOpen: false,
    };
  }

  const available = Math.max(
    0,
    windowHeight - lift - (input.fullScreen ? 0 : topInset),
  );
  return {
    height: available,
    marginBottom: lift,
    keyboardOpen: true,
  };
}

/**
 * Scroll offset that keeps a focused field inside the visible viewport.
 * Returns the current offset when the field is already fully visible.
 */
export function scrollOffsetToRevealField(input: {
  fieldY: number;
  fieldHeight: number;
  viewportHeight: number;
  currentOffset?: number;
  padding?: number;
}): number {
  const padding = input.padding ?? 8;
  const current = Math.max(0, input.currentOffset ?? 0);
  if (!(input.viewportHeight > 0)) return current;

  const fieldTop = input.fieldY;
  const fieldBottom = input.fieldY + input.fieldHeight;
  const visibleTop = current + padding;
  const visibleBottom = current + input.viewportHeight - padding;
  if (fieldTop >= visibleTop && fieldBottom <= visibleBottom) return current;

  if (fieldBottom - fieldTop >= input.viewportHeight - padding * 2) {
    return Math.max(0, fieldTop - padding);
  }
  if (fieldTop < visibleTop) return Math.max(0, fieldTop - padding);
  return Math.max(0, fieldBottom - input.viewportHeight + padding);
}

export type AddMemberFieldBox = {
  y: number;
  height: number;
};

export type AddMemberFieldReveal = {
  offset: number;
  /**
   * Insert this many pixels immediately before `gapBeforeIndex` so a row that
   * cannot be scrolled away is pushed fully past the viewport. Zero when the
   * scroll offset alone keeps every non-focused row either complete or gone.
   */
  gap: number;
  gapBeforeIndex: number | null;
};

const FIELD_SLIVER_PX = 1;
/** Extra pixels so a helper line's antialiasing does not remain as a speck. */
const HELPER_HIDE_BLEED_PX = 4;

function fieldBottom(box: AddMemberFieldBox): number {
  return box.y + box.height;
}

function visibleFieldPx(
  box: AddMemberFieldBox,
  offset: number,
  viewportHeight: number,
): number {
  const top = offset;
  const bottom = offset + viewportHeight;
  return Math.max(0, Math.min(fieldBottom(box), bottom) - Math.max(box.y, top));
}

type FieldVisibility = "full" | "out" | "partial";

function fieldVisibility(
  box: AddMemberFieldBox,
  offset: number,
  viewportHeight: number,
): FieldVisibility {
  if (!(box.height > 0)) return "out";
  const shown = visibleFieldPx(box, offset, viewportHeight);
  if (shown <= FIELD_SLIVER_PX) return "out";
  if (shown >= box.height - FIELD_SLIVER_PX) return "full";
  return "partial";
}

/**
 * Scroll the focused Add person field into view without leaving a sliced row.
 *
 * `scrollOffsetToRevealField` only keeps the focused field on screen. On a
 * short phone that parks the next row (Phone, while Email is focused) a few
 * pixels inside the viewport, which cuts its label in half above the pinned
 * Add person button. A partial row is scrolled fully out when Name/Email
 * still fit. When it does not, `gap` is empty padding that pushes the row
 * past the fold. Callers must pass natural y positions, with any gap this
 * function previously applied already subtracted.
 */
export function revealAddMemberField(input: {
  fields: AddMemberFieldBox[];
  focusedIndex: number;
  viewportHeight: number;
  currentOffset?: number;
  padding?: number;
  /** Indexes that must stay fully visible together with the focused field. */
  alsoVisible?: number[];
  /**
   * Helper copy above the fields (the "Add them now…" line). When it is only
   * partly in the viewport, scroll it fully out instead of leaving a cut line.
   * Callers pass natural y, in the same coordinates as `fields`.
   */
  hidePartialAbove?: AddMemberFieldBox | null;
}): AddMemberFieldReveal {
  const viewport = input.viewportHeight;
  const current = Math.max(0, input.currentOffset ?? 0);
  const focused = input.fields[input.focusedIndex];
  if (!focused || !(viewport > 0)) {
    return { offset: current, gap: 0, gapBeforeIndex: null };
  }

  const required = new Set<number>([
    input.focusedIndex,
    ...(input.alsoVisible ?? []),
  ]);
  let minOffset = 0;
  let maxOffset = Number.POSITIVE_INFINITY;
  for (const index of required) {
    const box = input.fields[index];
    if (!box || !(box.height > 0)) continue;
    minOffset = Math.max(minOffset, fieldBottom(box) - viewport);
    maxOffset = Math.min(maxOffset, box.y);
  }
  minOffset = Math.max(0, minOffset);
  if (!Number.isFinite(maxOffset) || maxOffset < minOffset) {
    minOffset = Math.max(0, fieldBottom(focused) - viewport);
    maxOffset = Math.max(minOffset, Math.max(0, focused.y));
  }

  const preferred = scrollOffsetToRevealField({
    fieldY: focused.y,
    fieldHeight: focused.height,
    viewportHeight: viewport,
    currentOffset: current,
    padding: input.padding,
  });
  let offset = Math.min(Math.max(preferred, minOffset), maxOffset);

  const hideBelow = (index: number) => {
    const box = input.fields[index];
    if (!box || fieldVisibility(box, offset, viewport) !== "partial") return;
    const hideAt = box.y - viewport;
    if (hideAt >= minOffset && hideAt <= maxOffset) offset = hideAt;
  };

  const nextIndex = input.focusedIndex + 1;
  if (nextIndex < input.fields.length) hideBelow(nextIndex);

  for (let index = input.focusedIndex - 1; index >= 0; index -= 1) {
    if (required.has(index)) continue;
    const box = input.fields[index];
    if (!box || fieldVisibility(box, offset, viewport) !== "partial") continue;
    const hideAt = fieldBottom(box);
    if (hideAt >= minOffset && hideAt <= maxOffset) {
      offset = hideAt;
      continue;
    }
    const showAt = Math.max(minOffset, fieldBottom(box) - viewport);
    if (
      showAt <= maxOffset &&
      fieldVisibility(box, showAt, viewport) === "full"
    ) {
      offset = showAt;
    }
  }

  if (nextIndex < input.fields.length) hideBelow(nextIndex);

  let gap = 0;
  let gapBeforeIndex: number | null = null;
  for (let index = nextIndex; index < input.fields.length; index += 1) {
    const box = input.fields[index];
    if (!box || fieldVisibility(box, offset, viewport) !== "partial") continue;
    const hideAt = box.y - viewport;
    if (hideAt >= minOffset && hideAt <= maxOffset) {
      offset = hideAt;
      continue;
    }
    gap = Math.max(0, Math.ceil(offset + viewport - box.y));
    gapBeforeIndex = index;
    break;
  }

  // Only ever increase the offset here. Showing the helper again would put
  // the cut line back, and pulling a field back on screen can do the same.
  const offsetBeforeHelper = offset;
  const above = input.hidePartialAbove;
  if (above && above.height > 0) {
    const shown = visibleFieldPx(
      { y: above.y, height: above.height + HELPER_HIDE_BLEED_PX },
      offset,
      viewport,
    );
    if (shown > 0 && shown < above.height + HELPER_HIDE_BLEED_PX) {
      const hideAt = fieldBottom(above) + HELPER_HIDE_BLEED_PX;
      if (hideAt >= minOffset && hideAt <= maxOffset && hideAt > offset) {
        offset = hideAt;
      }
    }
  }
  if (offset !== offsetBeforeHelper) {
    for (let index = input.focusedIndex - 1; index >= 0; index -= 1) {
      if (required.has(index)) continue;
      const box = input.fields[index];
      if (!box || fieldVisibility(box, offset, viewport) !== "partial") continue;
      const hideAt = fieldBottom(box);
      if (hideAt >= minOffset && hideAt <= maxOffset && hideAt > offset) {
        offset = hideAt;
      }
    }
  }
  if (offset !== offsetBeforeHelper) {
    gap = 0;
    gapBeforeIndex = null;
    for (let index = nextIndex; index < input.fields.length; index += 1) {
      const box = input.fields[index];
      if (!box || fieldVisibility(box, offset, viewport) !== "partial") continue;
      const hideAt = box.y - viewport;
      if (hideAt >= minOffset && hideAt <= maxOffset) {
        offset = hideAt;
        break;
      }
      gap = Math.max(0, Math.ceil(offset + viewport - box.y));
      gapBeforeIndex = index;
      break;
    }
  }

  return { offset: Math.max(0, offset), gap, gapBeforeIndex };
}
