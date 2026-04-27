import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Spinner } from "@/components/hms";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    void navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <Spinner size="lg" />
      </div>
    );
  }
  return null;
}
