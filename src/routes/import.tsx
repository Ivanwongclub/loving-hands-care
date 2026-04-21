import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/import")({
  component: () => <AdminStubPage titleKey="nav.import" />,
});
