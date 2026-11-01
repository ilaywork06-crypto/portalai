import { Component, type ReactNode } from "react";

interface Props {
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}

/** Keeps a render error inside the region that threw, instead of React unmounting the whole app to a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  private readonly retry = () => {
    this.setState({ failed: false });
  };

  override render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
