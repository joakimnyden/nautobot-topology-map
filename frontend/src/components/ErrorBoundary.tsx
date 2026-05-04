import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-slate-950 text-slate-200 p-6 font-mono text-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-3xl w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6 text-red-400">
              <AlertTriangle className="w-10 h-10" />
              <h2 className="text-2xl font-bold">Topology Map Crashed</h2>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-lg overflow-auto mb-6 max-h-[300px] border border-slate-800">
              <h3 className="text-red-300 font-semibold mb-2">{this.state.error?.toString()}</h3>
              <pre className="text-slate-400 text-xs whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack || this.state.error?.stack}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
