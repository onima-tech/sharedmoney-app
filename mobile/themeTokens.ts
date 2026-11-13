/**
 * Dark-mode colors read by the contrast test. `theme.ts` applies these values.
 * Light mode stays in `theme.ts`.
 */
export const darkThemeTokens = {
  /** Stronger brand blue. Light enough for 4.5:1 links, dark enough to read as enabled. */
  primary: "#4C8DFF",
  onPrimary: "#101827",
  background: "#11171D",
  surface: "#17202A",
} as const;
