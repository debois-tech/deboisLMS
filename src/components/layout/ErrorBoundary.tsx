import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defence: a render throw lands here instead of unmounting the whole tree. */
class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          centered
          message={this.state.error.message || 'Something went wrong rendering this page.'}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

/** Keyed by pathname so navigating away from a broken page clears the error. */
export default function ErrorBoundary({ children }: Props) {
  const { pathname } = useLocation();
  return <ErrorBoundaryInner key={pathname}>{children}</ErrorBoundaryInner>;
}
