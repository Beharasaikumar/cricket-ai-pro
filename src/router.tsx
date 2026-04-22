import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>

        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 text-xs text-red-500">{error.message}</pre>
        )}

        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset}>Try again</button>
          <a href="/">Go home</a>
        </div>
      </div>
    </div>
  );
}

const router = createRouter({
  routeTree,
  context: {},
  scrollRestoration: true,
  defaultErrorComponent: DefaultErrorComponent,
});

export function getRouter() {
  return router;
}