import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  widgetName?: string;
  onReset?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[WidgetErrorBoundary:${this.props.widgetName || "Widget"}] caught error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 flex flex-col items-center justify-center text-center gap-2.5 min-h-[140px] shadow-2xs">
          <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              {this.props.widgetName || "Widget"} Temporarily Unavailable
            </h4>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 max-w-sm line-clamp-2">
              {this.state.error?.message || "An unexpected issue occurred while rendering this component."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleRetry}
            className="h-7 text-xs px-3 rounded-lg border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100/50 gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Widget</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
