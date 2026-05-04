/**
 * Error Boundary Component
 * Catches React errors and provides fallback UI
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default error fallback UI
 */
const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
    <div className="rounded-full bg-destructive/10 p-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
    </div>
    <div className="text-center">
      <h3 className="text-lg font-semibold">Something went wrong</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred'}
      </p>
    </div>
    <Button onClick={resetError} variant="outline">
      <RefreshCw className="mr-2 h-4 w-4" />
      Try again
    </Button>
  </div>
);

/**
 * Error Boundary class component
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console and analytics
    logger.error('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback or default
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error!} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Alert-style error component for inline errors
 */
export const AlertError = ({ 
  message, 
  onDismiss 
}: { 
  message: string; 
  onDismiss?: () => void 
}) => (
  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-destructive hover:text-destructive/80"
        >
          ×
        </button>
      )}
    </div>
  </div>
);
