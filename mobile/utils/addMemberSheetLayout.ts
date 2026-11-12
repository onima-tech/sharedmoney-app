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
