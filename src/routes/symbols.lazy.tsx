import { UnderMigration } from "@/components/under-migration";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/symbols")({
  component: () => <UnderMigration />,
});
