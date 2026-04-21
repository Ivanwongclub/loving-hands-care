import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/staff")({
  component: () => <AdminStubPage titleKey="nav.staff" />,
});
