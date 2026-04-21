import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/residents")({
  component: () => <AdminStubPage titleKey="nav.residents" />,
});
