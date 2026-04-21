import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/incidents")({
  component: () => <AdminStubPage titleKey="nav.incidents" />,
});
