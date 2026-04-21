import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/tasks")({
  component: () => <AdminStubPage titleKey="nav.tasks" />,
});
