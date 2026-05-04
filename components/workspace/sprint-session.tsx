"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { isBefore, isAfter } from "date-fns";
import { ScrollArea } from "../ui/scroll-area";

interface SprintInfo {
  id: string;
  sprint_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  space: {
    id: string;
    name: string;
    space_id: string;
  };
  sprint_folder: {
    id: string;
    name: string;
    sprint_folder_id: string;
  };
  taskCount: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
}

interface SprintSessionProps {
  sprints: SprintInfo[];
  workspaceId: string;
}

export default function SprintSession({
  sprints,
  workspaceId: _workspaceId,
}: SprintSessionProps) {
  // WorkspaceId currently unused in this widget
  void _workspaceId;
  if (sprints.length === 0) {
    return null;
  }

  // Helper functions for sprint status
  const getSprintStatus = (sprint: SprintInfo) => {
    if (!sprint.start_date || !sprint.end_date) return "not-started";

    const now = new Date();
    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);

    if (isBefore(now, startDate)) return "not-started";
    if (isAfter(now, endDate)) return "completed";
    return "in-progress";
  };

  // Group sprints by sprint folder
  const sprintsByFolder = sprints.reduce((acc, sprint) => {
    const folderId = sprint.sprint_folder.sprint_folder_id;
    if (!acc[folderId]) {
      acc[folderId] = {
        folder: sprint.sprint_folder,
        sprints: [],
      };
    }
    acc[folderId].sprints.push(sprint);
    return acc;
  }, {} as Record<string, { folder: SprintInfo["sprint_folder"]; sprints: SprintInfo[] }>);

  return (
    <div className="h-full">
      <Card className="shadow-sm workspace-header-bg border workspace-border h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-bold">
              Sprint Statistics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Active and completed sprints
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Main Statistics Section */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-3xl font-bold mb-1">{sprints.length}</div>
                <div className="text-sm text-muted-foreground">
                  Total Sprints
                </div>
              </div>

              {/* Simple Bar Chart */}
              <div className="flex items-end gap-2 h-16">
                {[3, 2, 8, 5, 4, 7, 2, 1, 6, 9].map((height, index) => (
                  <div
                    key={index}
                    className="w-2 workspace-primary rounded-sm"
                    style={{ height: `${height * 10}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sprint Breakdown */}
          <div className="border-t workspace-border">
            <div className="py-4">
              <ScrollArea className="h-[180px] px-6">
                <div className="space-y-3">
                  {Object.values(sprintsByFolder).map(
                    ({ folder, sprints: folderSprints }) => {
                      const activeCount = folderSprints.filter(
                        (sprint) => getSprintStatus(sprint) === "in-progress"
                      ).length;
                      const completedCount = folderSprints.filter(
                        (sprint) => getSprintStatus(sprint) === "completed"
                      ).length;
                      const notStartedCount = folderSprints.filter(
                        (sprint) => getSprintStatus(sprint) === "not-started"
                      ).length;
                      const totalCount = folderSprints.length;
                      const activePercentage =
                        totalCount > 0
                          ? Math.round((activeCount / totalCount) * 100)
                          : 0;
                      const completedPercentage =
                        totalCount > 0
                          ? Math.round((completedCount / totalCount) * 100)
                          : 0;
                      const notStartedPercentage =
                        totalCount > 0
                          ? Math.round((notStartedCount / totalCount) * 100)
                          : 0;

                      return (
                        <div
                          key={folder.sprint_folder_id}
                          className="space-y-2"
                        >
                          {/* Folder Name */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium">
                                {folder.name}
                              </span>
                            </div>
                            <div className="text-sm font-semibold">
                              {totalCount}
                            </div>
                          </div>

                          {/* Not Started Sprints */}
                          {notStartedCount > 0 && (
                            <div className="flex items-center justify-between pl-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <span className="text-xs text-muted-foreground">
                                  Not Started
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">
                                  {notStartedCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {notStartedPercentage}%
                                </span>
                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                              </div>
                            </div>
                          )}

                          {/* Active Sprints */}
                          {activeCount > 0 && (
                            <div className="flex items-center justify-between pl-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-xs text-muted-foreground">
                                  Active
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">
                                  {activeCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {activePercentage}%
                                </span>
                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                              </div>
                            </div>
                          )}

                          {/* Completed Sprints */}
                          {completedCount > 0 && (
                            <div className="flex items-center justify-between pl-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-muted-foreground">
                                  Completed
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">
                                  {completedCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {completedPercentage}%
                                </span>
                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
