import { createContext, useContext, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const historyStack = useRef([]);

  useEffect(() => {
    const current = location.pathname;
    const stack = historyStack.current;
    if (stack.length === 0 || stack[stack.length - 1] !== current) {
      stack.push(current);
      // Keep stack bounded
      if (stack.length > 50) stack.shift();
    }
  }, [location.pathname]);

  const goBack = useCallback(() => {
    const stack = historyStack.current;
    if (stack.length > 1) {
      // Remove current page
      stack.pop();
      const prev = stack[stack.length - 1];
      navigate(prev);
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <NavigationContext.Provider value={{ goBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useBackNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    // Fallback if used outside provider
    return { goBack: () => window.history.back() };
  }
  return ctx;
}
