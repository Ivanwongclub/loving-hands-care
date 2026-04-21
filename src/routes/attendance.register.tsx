import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/attendance/register")({
  component: () => <AdminStubPage titleKey="nav.attendance" />,
});
