import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/emar")({
  component: () => <AdminStubPage titleKey="nav.emar" />,
});
