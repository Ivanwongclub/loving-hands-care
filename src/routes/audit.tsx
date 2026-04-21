import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/audit")({
  component: () => <AdminStubPage titleKey="nav.audit" />,
});
