import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { Spinner } from "@/components/hms";

export function FamilyProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, isFamilyPortalUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/family/login", replace: true });
      return;
    }
    if (isFamilyPortalUser === false) {
      // Staff user landed here — bounce to staff dashboard
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [session, loading, isFamilyPortalUser, navigate]);

  if (loading || !session || isFamilyPortalUser === null) {
    return (
      <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (isFamilyPortalUser === false) return null; // redirect in flight
  return <>{children}</>;
}
