import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isAuthenticated } from "./auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      void navigate({ to: "/login" });
    } else {
      setOk(true);
    }
  }, [navigate]);

  if (!ok) return null;
  return <>{children}</>;
}
