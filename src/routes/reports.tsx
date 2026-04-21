import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/reports")({
  component: () => <AdminStubPage titleKey="nav.reports" />,
});
