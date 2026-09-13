import { Component, type ErrorInfo, type ReactNode } from "react";
import { COPY } from "@/game/help";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Soft-fail HUD / overlay crashes so the canvas can keep running. */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg/80 px-6 text-center text-fg">
        <p className="font-display text-3xl tracking-tight">{COPY.overlayError}</p>
        <p className="max-w-sm text-sm text-muted">{this.state.error.message || COPY.overlayErrorFallback}</p>
        <button
          type="button"
          className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg"
          onClick={() => this.setState({ error: null })}
        >
          Retry
        </button>
      </div>
    );
  }
}
