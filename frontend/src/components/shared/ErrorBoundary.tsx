import React from 'react';
import { Button } from '../ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg">
          <div className="text-center px-6">
            <p className="text-lg font-bold mb-2 text-brand">
              予期しないエラーが発生しました
            </p>
            <p className="text-sm mb-4 text-brand-muted">
              {this.state.error?.message}
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="brand-gradient"
              size="pill-sm"
            >
              再読み込み
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
