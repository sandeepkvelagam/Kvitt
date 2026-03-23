import React, { createContext, useContext } from "react";

/** True when the screen is rendered inside the main bottom tab navigator (no stack “back” to dashboard). */
export const TabShellContext = createContext<{ isMainTabShell: boolean }>({ isMainTabShell: false });

export function useTabShell() {
  return useContext(TabShellContext);
}
