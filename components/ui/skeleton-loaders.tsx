import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

// Project card skeleton
export function ProjectCardSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

// Task item skeleton
export function TaskItemSkeleton() {
  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg">
      <Skeleton className="h-4 w-4 rounded-sm" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-4 w-4" />
    </div>
  );
}

// Inbox item skeleton
export function InboxItemSkeleton() {
  return (
    <div className="flex items-start space-x-3 p-4 border-b">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex items-center space-x-2 mt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Sidebar navigation skeleton
export function SidebarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-4/5" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    </div>
  );
}

// Dashboard widget skeleton
export function DashboardWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <div className="space-y-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-4/5" />
          <Skeleton className="h-2 w-3/5" />
        </div>
      </CardContent>
    </Card>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-4 p-4 border-b">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// Generic list skeleton
export function ListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center space-x-3 p-3 border rounded-lg"
        >
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

// Page skeleton for workspace pages
export function WorkspacePageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardWidgetSkeleton />
        <DashboardWidgetSkeleton />
        <DashboardWidgetSkeleton />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <TableSkeleton />
      </div>
    </div>
  );
}
