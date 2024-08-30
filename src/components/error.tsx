import React from "react";

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  {
    hasError: boolean;
    error: null | Error;
  }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div>
          Something went wrong:
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
