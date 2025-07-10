import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Dennis Chung personal website",
      },
      {
        title: "Landing Page | Dennis Chung personal website",
      },
    ],
  }),
});
