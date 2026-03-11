import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import i18n from '../../i18n';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    const t = i18n.t.bind(i18n);
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-lg text-center bg-gray-900 text-white">
          <div className="bg-red-500/10 p-xl rounded-full mb-lg">
            <AlertOctagon size={64} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-md">{t('error_boundary.title')}</h1>
          <p className="text-muted mb-xl max-w-md">
            {t('error_boundary.description')}
          </p>
          
          <div className="flex gap-md">
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-primary flex items-center gap-sm"
            >
              <RefreshCw size={18} />
              {t('error_boundary.reload')}
            </button>
            <a 
              href="/"
              className="btn btn-outline flex items-center gap-sm"
            >
              <Home size={18} />
              {t('error_boundary.home')}
            </a>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <div className="mt-xl p-md bg-black/50 rounded text-left overflow-auto max-w-full text-xs font-mono border border-white/10">
              <p className="text-red-400 font-bold mb-sm">{this.state.error.toString()}</p>
              <pre>{this.state.error.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
