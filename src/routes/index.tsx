import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: isAuthenticated() ? "/dashboard" : "/login", replace: true });
  }, [navigate]);
  return null;
}
