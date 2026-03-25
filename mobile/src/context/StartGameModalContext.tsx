import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type StartGameModalOpenOptions = {
  groupId?: string;
  groupName?: string;
};

type Ctx = {
  visible: boolean;
  openOptions: StartGameModalOpenOptions | null;
  openStartGame: (opts?: StartGameModalOpenOptions) => void;
  closeStartGame: () => void;
};

const StartGameModalContext = createContext<Ctx | null>(null);

export function StartGameModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [openOptions, setOpenOptions] = useState<StartGameModalOpenOptions | null>(null);

  const openStartGame = useCallback((opts?: StartGameModalOpenOptions) => {
    setOpenOptions(opts ?? null);
    setVisible(true);
  }, []);

  const closeStartGame = useCallback(() => {
    setVisible(false);
    setOpenOptions(null);
  }, []);

  const value = useMemo(
    () => ({ visible, openOptions, openStartGame, closeStartGame }),
    [visible, openOptions, openStartGame, closeStartGame]
  );

  return <StartGameModalContext.Provider value={value}>{children}</StartGameModalContext.Provider>;
}

export function useStartGameModal() {
  const ctx = useContext(StartGameModalContext);
  if (!ctx) throw new Error("useStartGameModal requires StartGameModalProvider");
  return ctx;
}
