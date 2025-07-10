import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from "@tanstack/react-router";

// Import the generated route tree
import { ErrorBoundary } from "@/components/error";
import { routeTree } from "@/routeTree.gen";

import "@/index.css";

const hashHistory = createHashHistory();
// Create a new router instance
const router = createRouter({
  routeTree,
  history: hashHistory,
  scrollRestoration: true,
  scrollRestorationBehavior: "smooth",
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <RouterProvider router={router}></RouterProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

async function removeOldSW() {
  if (typeof window !== "undefined") {
    const swList = await navigator.serviceWorker.getRegistrations();
    swList
      .find((sw) => sw.scope === "https://hikarintu.github.io/homepage/")
      ?.unregister();
  }
}
removeOldSW();
