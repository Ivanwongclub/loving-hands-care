import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/settings")({
  component: () => <AdminStubPage titleKey="nav.settings" />,
});
