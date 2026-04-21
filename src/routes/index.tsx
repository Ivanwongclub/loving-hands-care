import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

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
  return null;
}
