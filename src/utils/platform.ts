const userAgent =
  typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
    ? navigator.userAgent
    : "";

export const isMac = userAgent.includes("Macintosh");

/** Returns `mac` label on macOS, `win` label on Windows/Linux */
export const sc = (mac: string, win: string): string => (isMac ? mac : win);
