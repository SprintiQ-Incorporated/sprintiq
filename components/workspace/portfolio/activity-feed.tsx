"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FileText,
  GitBranch,
  Users,
  CheckCircle2,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "created" | "updated" | "deleted" | "completed" | "assigned";
  entityType: "project" | "sprint" | "task" | "team" | "member";
  entityName: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  description?: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  maxItems?: number;
  className?: string;
}

const defaultActivities: ActivityItem[] = [
  {
    id: "1",
    type: "created",
    entityType: "project",
    entityName: "Mobile App Redesign",
    user: { name: "John Doe" },
    timestamp: "2 hours ago",
    description: "Created new project in Engineering portfolio",
  },
  {
    id: "2",
    type: "completed",
    entityType: "sprint",
    entityName: "Sprint 12",
    user: { name: "Jane Smith" },
    timestamp: "5 hours ago",
    description: "Completed sprint with 42 story points",
  },
  {
    id: "3",
    type: "assigned",
    entityType: "task",
    entityName: "Update authentication flow",
    user: { name: "Mike Johnson" },
    timestamp: "1 day ago",
    description: "Assigned task to Sarah Wilson",
  },
  {
    id: "4",
    type: "updated",
    entityType: "team",
    entityName: "Frontend Team",
    user: { name: "Sarah Wilson" },
    timestamp: "2 days ago",
    description: "Added 2 new members to the team",
  },
  {
    id: "5",
    type: "created",
    entityType: "sprint",
    entityName: "Sprint 13",
    user: { name: "John Doe" },
    timestamp: "3 days ago",
    description: "Started new sprint with 8 stories",
  },
];

export function ActivityFeed({
  activities = defaultActivities,
  maxItems = 5,
  className,
}: ActivityFeedProps) {
  const getActivityIcon = (
    type: ActivityItem["type"],
    entityType: ActivityItem["entityType"]
  ) => {
    if (type === "created") return <Plus className="w-4 h-4" />;
    if (type === "updated") return <Edit className="w-4 h-4" />;
    if (type === "deleted") return <Trash2 className="w-4 h-4" />;
    if (type === "completed") return <CheckCircle2 className="w-4 h-4" />;

    // Default based on entity type
    if (entityType === "project") return <FileText className="w-4 h-4" />;
    if (entityType === "sprint") return <GitBranch className="w-4 h-4" />;
    if (entityType === "team") return <Users className="w-4 h-4" />;

    return <FileText className="w-4 h-4" />;
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "created":
        return "bg-green-100 text-green-600";
      case "updated":
        return "bg-blue-100 text-blue-600";
      case "deleted":
        return "bg-red-100 text-red-600";
      case "completed":
        return "bg-purple-100 text-purple-600";
      case "assigned":
        return "bg-amber-100 text-amber-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getActionText = (type: ActivityItem["type"]) => {
    switch (type) {
      case "created":
        return "created";
      case "updated":
        return "updated";
      case "deleted":
        return "deleted";
      case "completed":
        return "completed";
      case "assigned":
        return "assigned";
      default:
        return "modified";
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {displayedActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">📭</div>
              <p className="text-sm text-gray-500">No recent activity</p>
            </div>
          ) : (
            displayedActivities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="flex gap-3">
                  {/* Activity Icon */}
                  <div
                    className={cn(
                      "activity-icon",
                      getActivityColor(activity.type)
                    )}
                  >
                    {getActivityIcon(activity.type, activity.entityType)}
                  </div>

                  {/* Activity Content */}
                  <div className="activity-content flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="activity-title text-sm">
                          <span className="font-medium text-gray-900">
                            {activity.user.name}
                          </span>{" "}
                          <span className="text-gray-600">
                            {getActionText(activity.type)}
                          </span>{" "}
                          <span className="font-medium text-gray-900">
                            {activity.entityName}
                          </span>
                        </p>
                        {activity.description && (
                          <p className="activity-description text-xs text-gray-500 mt-0.5">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <span className="activity-time text-xs text-gray-400 whitespace-nowrap">
                        {activity.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {activities.length > maxItems && (
          <div className="text-center mt-4">
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all activity ({activities.length})
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
