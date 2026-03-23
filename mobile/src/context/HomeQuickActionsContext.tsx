import React, { createContext, useContext } from "react";

export type HomeQuickActionsValue = {
  quickActionsOpen: boolean;
  setQuickActionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const HomeQuickActionsContext = createContext<HomeQuickActionsValue | null>(null);

export function useHomeQuickActions(): HomeQuickActionsValue {
  const v = useContext(HomeQuickActionsContext);
  if (!v) {
    throw new Error("useHomeQuickActions must be used within MainTabNavigator");
  }
  return v;
}
