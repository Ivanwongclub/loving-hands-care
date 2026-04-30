// Global mode state for the feedback layer.
//
// Modes:
//   - off: no overlay rendered, no click interception
//   - on: element picker active, clicks intercepted
//
// Also tracks the currently-open pin (for side panel thread view).
//
// Implementation: React Context + useState.
// (Zustand is NOT in package.json; using stdlib React state.)

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type FeedbackModeState = {
  isOn: boolean;
  toggle: () => void;
  setOn: (on: boolean) => void;
  activePinId: string | null;
  setActivePin: (id: string | null) => void;
};

const FeedbackModeContext = createContext<FeedbackModeState | null>(null);

export function FeedbackModeProvider({ children }: { children: ReactNode }) {
  const [isOn, setIsOn] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const value = useMemo<FeedbackModeState>(() => ({
    isOn,
    toggle: () => setIsOn((v) => !v),
    setOn: setIsOn,
    activePinId,
    setActivePin: setActivePinId,
  }), [isOn, activePinId]);

  return (
    <FeedbackModeContext.Provider value={value}>
      {children}
    </FeedbackModeContext.Provider>
  );
}

export function useFeedbackMode(): FeedbackModeState {
  const ctx = useContext(FeedbackModeContext);
  if (!ctx) {
    throw new Error("useFeedbackMode must be called within <FeedbackModeProvider>");
  }
  return ctx;
}
