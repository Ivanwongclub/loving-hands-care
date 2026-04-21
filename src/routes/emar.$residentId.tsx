import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/emar/$residentId")({
  component: () => <AdminStubPage titleKey="nav.emar" />,
});
