import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/alerts")({
  component: () => <AdminStubPage titleKey="nav.alerts" />,
});
