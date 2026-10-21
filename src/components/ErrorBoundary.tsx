import { Component, ReactNode } from "react";
import { makeReference, reportFailure } from "../lib/operationOutcome";

type FallbackRender = (props: { reference: string; reset: () => void }) => ReactNode;

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Static fallback, or a render function that receives a retry callback. */
  fallback?: ReactNode | FallbackRender;
  /** Name of the contained section, used in diagnostics. */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  reference?: string;
}

/**
 * Contains render failures. Raw error text never reaches the screen: server
 * messages can contain validator internals and production redacts them anyway.
 * Mount route- or section-level instances (keyed by route) so one failure
 * keeps the header and navigation available.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, reference: makeReference() };
  }

  componentDidCatch(error: Error, info: unknown) {
    reportFailure(`render:${this.props.section ?? "app"}`, this.state.reference ?? "-", { error, info });
  }

  reset = () => {
    this.setState({ hasError: false, reference: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, reference = "-" } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    if (typeof fallback === "function") {
      return (fallback as FallbackRender)({ reference, reset: this.reset });
    }
    if (fallback) {
      return fallback;
    }

    return (
      <div className="min-h-screen flex items-center justify-center fi-app-shell px-4">
        <div className="fi-panel max-w-md w-full space-y-4 text-center p-8" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="fi-zone">HackJudge couldn't load</h2>
            <p className="text-sm fi-muted">
              Something went wrong while starting the app. Drafts saved on this device are kept.
            </p>
            <p className="text-xs fi-muted">Reference {reference}</p>
          </div>
          <div className="flex justify-center gap-3">
            <button onClick={this.handleReload} className="fi-transport">
              Reload
            </button>
            <a href="/" className="fi-key">
              Go to events
            </a>
          </div>
        </div>
      </div>
    );
  }
}
