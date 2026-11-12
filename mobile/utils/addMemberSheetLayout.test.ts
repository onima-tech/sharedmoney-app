import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMemberModeDismissesKeyboard,
  getAddMemberSheetFrame,
  keyboardHeightForAddMemberMode,
  keyboardLift,
  restingAddMemberSheetHeight,
  revealAddMemberField,
  scrollOffsetToRevealField,
} from "./addMemberSheetLayout.ts";

const IPHONE_SE = 667;
const IPHONE_SE_KEYBOARD = 260;
const IPHONE_SE_TOP = 20;
const ANDROID_SHORT = 640;
const ANDROID_KEYBOARD = 280;
const ANDROID_TOP = 24;

describe("restingAddMemberSheetHeight", () => {
  it("keeps the closed bottom sheet at 64% of the window, capped at 560", () => {
    assert.equal(restingAddMemberSheetHeight(IPHONE_SE), IPHONE_SE * 0.64);
    assert.equal(restingAddMemberSheetHeight(900), 560);
    assert.equal(restingAddMemberSheetHeight(0), 0);
  });
});

describe("keyboardLift", () => {
  it("lifts by the overlap when the window does not resize", () => {
    assert.equal(
      keyboardLift({
        windowHeight: IPHONE_SE,
        restingWindowHeight: IPHONE_SE,
        keyboardHeight: IPHONE_SE_KEYBOARD,
        keyboardScreenY: IPHONE_SE - IPHONE_SE_KEYBOARD,
      }),
      IPHONE_SE_KEYBOARD,
    );
  });

  it("does not lift after the keyboard hides below the window", () => {
    assert.equal(
      keyboardLift({
        windowHeight: IPHONE_SE,
        restingWindowHeight: IPHONE_SE,
        keyboardHeight: IPHONE_SE_KEYBOARD,
        keyboardScreenY: IPHONE_SE,
      }),
      0,
    );
  });

  it("does not lift when Android already resized the window", () => {
    const resized = ANDROID_SHORT - ANDROID_KEYBOARD;
    assert.equal(
      keyboardLift({
        windowHeight: resized,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: resized,
      }),
      0,
    );
  });

  it("falls back to the reported height when screenY is missing or zero", () => {
    assert.equal(
      keyboardLift({
        windowHeight: ANDROID_SHORT,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: null,
      }),
      ANDROID_KEYBOARD,
    );
    assert.equal(
      keyboardLift({
        windowHeight: ANDROID_SHORT,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: 0,
      }),
      ANDROID_KEYBOARD,
    );
  });

  it("skips the fallback when a bad screenY arrives after the window resized", () => {
    const resized = ANDROID_SHORT - ANDROID_KEYBOARD;
    assert.equal(
      keyboardLift({
        windowHeight: resized,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: 0,
      }),
      0,
    );
  });

  it("uses the reported height when the overlap under-counts a full-size window", () => {
    assert.equal(
      keyboardLift({
        windowHeight: ANDROID_SHORT,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: ANDROID_SHORT - 240,
      }),
      ANDROID_KEYBOARD,
    );
  });

  it("caps a coordinate mismatch so the sheet cannot leave the screen", () => {
    assert.equal(
      keyboardLift({
        windowHeight: ANDROID_SHORT,
        restingWindowHeight: ANDROID_SHORT,
        keyboardHeight: ANDROID_KEYBOARD,
        keyboardScreenY: 40,
      }),
      ANDROID_KEYBOARD + 48,
    );
  });
});

describe("getAddMemberSheetFrame", () => {
  it("leaves the closed create sheet and the closed picker unchanged", () => {
    const closed = {
      windowHeight: IPHONE_SE,
      restingWindowHeight: IPHONE_SE,
      topInset: IPHONE_SE_TOP,
      keyboardHeight: 0,
      keyboardScreenY: null,
    };
    assert.deepEqual(getAddMemberSheetFrame({ ...closed, fullScreen: false }), {
      height: IPHONE_SE * 0.64,
      marginBottom: 0,
      keyboardOpen: false,
    });
    assert.deepEqual(getAddMemberSheetFrame({ ...closed, fullScreen: true }), {
      height: IPHONE_SE,
      marginBottom: 0,
      keyboardOpen: false,
    });
  });

  it("places the create sheet above an iPhone SE keyboard, below the status bar", () => {
    const frame = getAddMemberSheetFrame({
      windowHeight: IPHONE_SE,
      restingWindowHeight: IPHONE_SE,
      topInset: IPHONE_SE_TOP,
      keyboardHeight: IPHONE_SE_KEYBOARD,
      keyboardScreenY: IPHONE_SE - IPHONE_SE_KEYBOARD,
      fullScreen: false,
    });
    assert.equal(frame.keyboardOpen, true);
    assert.equal(frame.marginBottom, IPHONE_SE_KEYBOARD);
    assert.equal(frame.height, IPHONE_SE - IPHONE_SE_KEYBOARD - IPHONE_SE_TOP);
    assert.ok(frame.height + frame.marginBottom <= IPHONE_SE);
  });

  it("places a short Android create sheet above the keyboard when the window does not resize", () => {
    const frame = getAddMemberSheetFrame({
      windowHeight: ANDROID_SHORT,
      restingWindowHeight: ANDROID_SHORT,
      topInset: ANDROID_TOP,
      keyboardHeight: ANDROID_KEYBOARD,
      keyboardScreenY: ANDROID_SHORT - ANDROID_KEYBOARD,
      fullScreen: false,
    });
    assert.equal(frame.keyboardOpen, true);
    assert.equal(frame.marginBottom, ANDROID_KEYBOARD);
    assert.equal(frame.height, ANDROID_SHORT - ANDROID_KEYBOARD - ANDROID_TOP);
  });

  it("fills the resized Android window instead of lifting twice", () => {
    const resized = ANDROID_SHORT - ANDROID_KEYBOARD;
    const frame = getAddMemberSheetFrame({
      windowHeight: resized,
      restingWindowHeight: ANDROID_SHORT,
      topInset: ANDROID_TOP,
      keyboardHeight: ANDROID_KEYBOARD,
      keyboardScreenY: resized,
      fullScreen: false,
    });
    assert.equal(frame.keyboardOpen, true);
    assert.equal(frame.marginBottom, 0);
    assert.equal(frame.height, resized - ANDROID_TOP);
  });

  it("keeps the existing-person picker above the keyboard without double-counting the top inset", () => {
    const frame = getAddMemberSheetFrame({
      windowHeight: ANDROID_SHORT,
      restingWindowHeight: ANDROID_SHORT,
      topInset: ANDROID_TOP,
      keyboardHeight: ANDROID_KEYBOARD,
      keyboardScreenY: ANDROID_SHORT - ANDROID_KEYBOARD,
      fullScreen: true,
    });
    assert.equal(frame.height, ANDROID_SHORT - ANDROID_KEYBOARD);
    assert.equal(frame.marginBottom, ANDROID_KEYBOARD);
    assert.equal(frame.keyboardOpen, true);
  });
});

describe("scrollOffsetToRevealField", () => {
  it("leaves the offset alone when the field is already visible", () => {
    assert.equal(
      scrollOffsetToRevealField({
        fieldY: 40,
        fieldHeight: 56,
        viewportHeight: 240,
        currentOffset: 0,
      }),
      0,
    );
  });

  it("scrolls a lower field up until it clears the bottom padding", () => {
    assert.equal(
      scrollOffsetToRevealField({
        fieldY: 220,
        fieldHeight: 56,
        viewportHeight: 192,
        currentOffset: 0,
        padding: 8,
      }),
      220 + 56 - 192 + 8,
    );
  });

  it("scrolls back up when the focused field is above the viewport", () => {
    assert.equal(
      scrollOffsetToRevealField({
        fieldY: 24,
        fieldHeight: 56,
        viewportHeight: 180,
        currentOffset: 140,
        padding: 8,
      }),
      16,
    );
  });

  it("returns the current offset when the viewport is not measured yet", () => {
    assert.equal(
      scrollOffsetToRevealField({
        fieldY: 80,
        fieldHeight: 56,
        viewportHeight: 0,
        currentOffset: 12,
      }),
      12,
    );
  });
});

/**
 * Short Android create sheet while the keyboard is open.
 * Window 640, status bar 24, keyboard 280: the sheet is 336dp and the
 * scrollport under the grabber, header, and pinned Add person footer is
 * shorter than Name + Email + Phone stacked.
 */
const SHORT_ANDROID_EMAIL_FIELDS = {
  name: { y: 40, height: 72 },
  email: { y: 112, height: 72 },
  phone: { y: 184, height: 72 },
};

function phoneVisiblePx(
  offset: number,
  viewport: number,
  phoneY = SHORT_ANDROID_EMAIL_FIELDS.phone.y,
): number {
  const top = Math.max(phoneY, offset);
  const bottom = Math.min(phoneY + SHORT_ANDROID_EMAIL_FIELDS.phone.height, offset + viewport);
  return Math.max(0, bottom - top);
}

describe("short Android email focus with the keyboard open", () => {
  const frame = getAddMemberSheetFrame({
    windowHeight: ANDROID_SHORT,
    restingWindowHeight: ANDROID_SHORT,
    topInset: ANDROID_TOP,
    keyboardHeight: ANDROID_KEYBOARD,
    keyboardScreenY: ANDROID_SHORT - ANDROID_KEYBOARD,
    fullScreen: false,
  });

  it("lifts the create sheet above the keyboard", () => {
    assert.equal(frame.keyboardOpen, true);
    assert.equal(frame.marginBottom, ANDROID_KEYBOARD);
    assert.equal(frame.height, ANDROID_SHORT - ANDROID_KEYBOARD - ANDROID_TOP);
  });

  it("does not leave a cut Phone label between Email and Add person", () => {
    // Scrollport inside the 336dp sheet. Name and Email fit; Phone starts
    // in the port and the unfixed reveal keeps a cut "Phone (optional)" label.
    const viewport = 208;
    const { name, email, phone } = SHORT_ANDROID_EMAIL_FIELDS;
    const unfixed = scrollOffsetToRevealField({
      fieldY: email.y,
      fieldHeight: email.height,
      viewportHeight: viewport,
      currentOffset: 0,
    });
    const unfixedPhone = phoneVisiblePx(unfixed, viewport);
    assert.ok(
      unfixedPhone > 8 && unfixedPhone < phone.height,
      `fixture must reproduce the sliced phone label, saw ${unfixedPhone}px`,
    );

    const reveal = revealAddMemberField({
      fields: [name, email, phone],
      focusedIndex: 1,
      alsoVisible: [0],
      viewportHeight: viewport,
      currentOffset: 0,
    });
    const phoneY = phone.y + (reveal.gapBeforeIndex === 2 ? reveal.gap : 0);
    const visibleTop = reveal.offset;
    const visibleBottom = reveal.offset + viewport;

    assert.ok(name.y >= visibleTop && name.y + name.height <= visibleBottom, "Name stays fully visible");
    assert.ok(email.y >= visibleTop && email.y + email.height <= visibleBottom, "Email stays fully visible");
    assert.ok(
      phoneY >= visibleBottom,
      `Phone must be fully out of the viewport, top ${phoneY} visibleBottom ${visibleBottom}`,
    );
    assert.equal(phoneVisiblePx(reveal.offset, viewport, phoneY), 0);
    assert.ok(reveal.gap > 0, "expected empty padding when the phone row cannot be scrolled away");
  });

  it("scrolls Phone fully out when Email must move up to stay above the footer", () => {
    const viewport = 160;
    const { name, email, phone } = SHORT_ANDROID_EMAIL_FIELDS;
    const unfixed = scrollOffsetToRevealField({
      fieldY: email.y,
      fieldHeight: email.height,
      viewportHeight: viewport,
      currentOffset: 0,
    });
    assert.ok(phoneVisiblePx(unfixed, viewport) > 0);

    const reveal = revealAddMemberField({
      fields: [name, email, phone],
      focusedIndex: 1,
      alsoVisible: [0],
      viewportHeight: viewport,
      currentOffset: 0,
    });
    const phoneY = phone.y + (reveal.gapBeforeIndex === 2 ? reveal.gap : 0);
    const visibleTop = reveal.offset;
    const visibleBottom = reveal.offset + viewport;

    assert.equal(reveal.gap, 0);
    assert.ok(name.y >= visibleTop && name.y + name.height <= visibleBottom);
    assert.ok(email.y >= visibleTop && email.y + email.height <= visibleBottom);
    assert.ok(phoneY >= visibleBottom);
    assert.equal(phoneVisiblePx(reveal.offset, viewport, phoneY), 0);
  });

  it("does not leave a sliced Name or Email when Phone is focused", () => {
    const viewport = 160;
    const { name, email, phone } = SHORT_ANDROID_EMAIL_FIELDS;
    const reveal = revealAddMemberField({
      fields: [name, email, phone],
      focusedIndex: 2,
      viewportHeight: viewport,
      currentOffset: 0,
    });
    const visibleTop = reveal.offset;
    const visibleBottom = reveal.offset + viewport;
    const boxes = [name, email, phone].map((box, index) => {
      const shifted = reveal.gapBeforeIndex != null && index >= reveal.gapBeforeIndex
        ? { ...box, y: box.y + reveal.gap }
        : box;
      return shifted;
    });
    assert.ok(boxes[2].y >= visibleTop && boxes[2].y + boxes[2].height <= visibleBottom);
    for (const box of boxes) {
      const shown = Math.max(
        0,
        Math.min(box.y + box.height, visibleBottom) - Math.max(box.y, visibleTop),
      );
      const partial = shown > 1 && shown < box.height - 1;
      assert.equal(partial, false);
    }
  });
});

function shownPx(
  box: { y: number; height: number },
  offset: number,
  viewport: number,
): number {
  const top = Math.max(box.y, offset);
  const bottom = Math.min(box.y + box.height, offset + viewport);
  return Math.max(0, bottom - top);
}

describe("method chooser keyboard", () => {
  it("dismisses a leftover keyboard and does not lift the sheet", () => {
    assert.equal(addMemberModeDismissesKeyboard("chooser"), true);
    assert.equal(addMemberModeDismissesKeyboard("create"), false);
    assert.equal(addMemberModeDismissesKeyboard("existing"), false);
    assert.equal(keyboardHeightForAddMemberMode("chooser", IPHONE_SE_KEYBOARD), 0);
    assert.equal(
      keyboardHeightForAddMemberMode("create", IPHONE_SE_KEYBOARD),
      IPHONE_SE_KEYBOARD,
    );
    assert.equal(
      keyboardHeightForAddMemberMode("existing", IPHONE_SE_KEYBOARD),
      IPHONE_SE_KEYBOARD,
    );

    const frame = getAddMemberSheetFrame({
      windowHeight: IPHONE_SE,
      restingWindowHeight: IPHONE_SE,
      topInset: IPHONE_SE_TOP,
      keyboardHeight: keyboardHeightForAddMemberMode("chooser", IPHONE_SE_KEYBOARD),
      keyboardScreenY: IPHONE_SE - IPHONE_SE_KEYBOARD,
      fullScreen: false,
    });
    assert.equal(frame.keyboardOpen, false);
    assert.equal(frame.marginBottom, 0);
    assert.equal(frame.height, restingAddMemberSheetHeight(IPHONE_SE));
  });
});

describe("iPhone SE phone focus intro", () => {
  it("scrolls a clipped helper line fully out without slicing a field", () => {
    const viewport = 250;
    const intro = { y: 0, height: 36 };
    const name = { y: 44, height: 72 };
    const email = { y: 124, height: 72 };
    const phone = { y: 204, height: 72 };
    const fields = [name, email, phone];

    const unfixed = revealAddMemberField({
      fields,
      focusedIndex: 2,
      viewportHeight: viewport,
      currentOffset: 0,
    });
    const clipped = shownPx(intro, unfixed.offset, viewport);
    assert.ok(
      clipped > 1 && clipped < intro.height - 1,
      `fixture must clip the intro, saw ${clipped}px`,
    );

    const reveal = revealAddMemberField({
      fields,
      focusedIndex: 2,
      viewportHeight: viewport,
      currentOffset: 0,
      hidePartialAbove: intro,
    });
    assert.equal(shownPx(intro, reveal.offset, viewport), 0);
    const visibleTop = reveal.offset;
    const visibleBottom = reveal.offset + viewport;
    assert.ok(phone.y >= visibleTop && phone.y + phone.height <= visibleBottom);
    for (const box of fields) {
      const shown = shownPx(box, reveal.offset, viewport);
      const partial = shown > 1 && shown < box.height - 1;
      assert.equal(partial, false);
    }
  });
});
