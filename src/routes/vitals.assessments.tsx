import { createFileRoute } from "@tanstack/react-router";
import { AdminStubPage } from "@/components/AdminStubPage";

export const Route = createFileRoute("/vitals/assessments")({
  component: () => <AdminStubPage titleKey="nav.vitals" />,
});
