/**
 * Unified Loading States Component
 * Provides consistent loading UX across the application
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LoadingVariant = 'spinner' | 'skeleton' | 'page' | 'inline';

interface LoadingStateProps {
  variant?: LoadingVariant;
  message?: string;
  className?: string;
}

/**
 * Spinner loader - default circular spinner
 */
const SpinnerLoader = ({ message, className }: { message?: string; className?: string }) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 p-4', className)}>
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    {message && <p className="text-sm text-muted-foreground">{message}</p>}
  </div>
);

/**
 * Skeleton loader - for content placeholders
 */
const SkeletonLoader = ({ className }: { className?: string }) => (
  <div className={cn('space-y-3', className)}>
    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
    <div className="h-4 w-full animate-pulse rounded bg-muted" />
    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
  </div>
);

/**
 * Page loader - full page loading state
 */
const PageLoader = ({ message }: { message?: string }) => (
  <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
    {message && <p className="text-base text-muted-foreground">{message}</p>}
  </div>
);

/**
 * Inline loader - small loader for buttons and inline elements
 */
const InlineLoader = ({ message, className }: { message?: string; className?: string }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <Loader2 className="h-4 w-4 animate-spin" />
    {message && <span className="text-sm">{message}</span>}
  </span>
);

/**
 * Main LoadingState component with variant support
 */
export const LoadingState = ({ 
  variant = 'spinner', 
  message,
  className 
}: LoadingStateProps) => {
  switch (variant) {
    case 'spinner':
      return <SpinnerLoader message={message} className={className} />;
    case 'skeleton':
      return <SkeletonLoader className={className} />;
    case 'page':
      return <PageLoader message={message} />;
    case 'inline':
      return <InlineLoader message={message} className={className} />;
    default:
      return <SpinnerLoader message={message} className={className} />;
  }
};

/**
 * Export individual loaders for direct use
 */
export { SpinnerLoader, SkeletonLoader, PageLoader, InlineLoader };
