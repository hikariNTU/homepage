import { CVPage } from "@/components/cv-page";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/cv/{-$var}")({
  component: () => {
    return <CVWrapper />;
  },
});

function CVWrapper() {
  const params = Route.useParams();

  return <CVPage var={params.var} />;
}
