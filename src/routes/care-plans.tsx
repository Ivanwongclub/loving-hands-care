import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/care-plans")({
  component: () => <AdminStubPage titleKey="nav.carePlans" />,
});
