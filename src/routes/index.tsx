import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Spinner } from "@/components/hms";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { session, loading, isFamilyPortalUser } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    // Wait for portal status before bouncing
    if (isFamilyPortalUser === null) return;
    void navigate({
      to: isFamilyPortalUser ? "/family/dashboard" : "/dashboard",
      replace: true,
    });
  }, [loading, session, isFamilyPortalUser, navigate]);

  return (
    <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
      <Spinner size="lg" />
    </div>
  );
}
