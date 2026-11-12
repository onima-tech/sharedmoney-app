import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";

export type KeyboardFrame = {
  height: number;
  screenY: number | null;
};

const CLOSED_FRAME: KeyboardFrame = { height: 0, screenY: null };

function frameFromEvent(event: KeyboardEvent): KeyboardFrame {
  const height = event.endCoordinates?.height;
  const screenY = event.endCoordinates?.screenY;
  return {
    height: typeof height === "number" && Number.isFinite(height)
      ? Math.max(0, height)
      : 0,
    screenY: typeof screenY === "number" && Number.isFinite(screenY)
      ? screenY
      : null,
  };
}

/**
 * Keyboard frame for the Add people sheet.
 * iOS follows keyboardWillChangeFrame, including interactive dismiss.
 * Android and web emit did-show / did-hide.
 */
export function useKeyboardOverlap(enabled: boolean): {
  frame: KeyboardFrame;
  windowHeight: number;
  restingWindowHeight: number;
} {
  const { height: windowHeight } = useWindowDimensions();
  const [frame, setFrame] = useState<KeyboardFrame>(CLOSED_FRAME);
  const restingWindowHeight = useRef(windowHeight);

  if (frame.height <= 0) {
    restingWindowHeight.current = windowHeight;
  }

  useEffect(() => {
    if (!enabled) {
      setFrame(CLOSED_FRAME);
      return;
    }

    const onFrame = (event: KeyboardEvent) => {
      setFrame(frameFromEvent(event));
    };
    const onHide = () => {
      setFrame(CLOSED_FRAME);
    };

    if (Platform.OS === "ios") {
      const change = Keyboard.addListener("keyboardWillChangeFrame", onFrame);
      const hide = Keyboard.addListener("keyboardWillHide", onHide);
      return () => {
        change.remove();
        hide.remove();
      };
    }

    const show = Keyboard.addListener("keyboardDidShow", onFrame);
    const hide = Keyboard.addListener("keyboardDidHide", onHide);
    const removeNative = () => {
      show.remove();
      hide.remove();
    };

    // react-native-web's Keyboard listeners are a no-op. Mobile browsers
    // overlay the keyboard and shrink visualViewport instead.
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      window.visualViewport == null
    ) {
      return removeNative;
    }

    const viewport = window.visualViewport;
    const onViewport = () => {
      const layoutHeight = window.innerHeight;
      const visibleBottom = viewport.offsetTop + viewport.height;
      const overlap = Math.max(0, Math.round(layoutHeight - visibleBottom));
      const next = overlap > 0
        ? { height: overlap, screenY: layoutHeight - overlap }
        : CLOSED_FRAME;
      setFrame((prev) =>
        prev.height === next.height && prev.screenY === next.screenY ? prev : next
      );
    };
    viewport.addEventListener("resize", onViewport);
    viewport.addEventListener("scroll", onViewport);
    return () => {
      removeNative();
      viewport.removeEventListener("resize", onViewport);
      viewport.removeEventListener("scroll", onViewport);
    };
  }, [enabled]);

  return {
    frame,
    windowHeight,
    restingWindowHeight: restingWindowHeight.current,
  };
}
