import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { Spinner } from "@/components/hms";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, isFamilyPortalUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    // Family portal user landed on staff route — bounce them to family dashboard
    if (isFamilyPortalUser === true) {
      void navigate({ to: "/family/dashboard", replace: true });
    }
  }, [loading, session, isFamilyPortalUser, navigate]);

  // Still resolving family portal status
  if (loading || (session && isFamilyPortalUser === null)) {
    return (
      <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (!session) return null;
  if (isFamilyPortalUser === true) return null; // redirect in flight
  return <>{children}</>;
}
