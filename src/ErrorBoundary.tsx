import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GLOBAL ERROR BOUNDARY:", error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-military-black text-white flex flex-col items-center justify-center p-6 text-center selection:bg-military-gold selection:text-military-black">
          <div className="card-military max-w-md w-full p-8 space-y-6 border border-red-500/30 bg-bg-panel shadow-2xl rounded-2xl">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold uppercase tracking-tight text-white">
                Falha no Carregamento
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                {this.state.error?.message || "Ocorreu um erro inesperado ao carregar esta página."}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-military-gold text-military-black hover:bg-yellow-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw size={16} />
              <span>Tentar Novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
