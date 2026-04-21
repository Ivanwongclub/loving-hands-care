import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/vitals")({
  component: () => <AdminStubPage titleKey="nav.vitals" />,
});
