"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useState } from "react";

interface TaskProjectStatusProps {
  tasksPerSpace: {
    space: {
      id: string;
      name: string;
    };
    count: number;
  }[];
  projectsPerSpace: {
    space: {
      id: string;
      name: string;
    };
    count: number;
  }[];
}

export default function TaskProjectStatus({
  tasksPerSpace,
  projectsPerSpace,
}: TaskProjectStatusProps) {
  const [view, setView] = useState<"tasks" | "projects">("tasks");
  const [spaceHoveredSegment, setSpaceHoveredSegment] = useState<any>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const pieData =
    view === "tasks"
      ? tasksPerSpace
          .filter(
            (space: any) =>
              !space.space.deleted_at &&
              !space.space?.projects?.some((project: any) => project.deleted_at)
          )
          .map((space, index) => ({
            id: space.space.id,
            name: space.space.name,
            value: space.count,
            color: `hsl(${index * 50}, 70%, 50%)`,
          }))
      : projectsPerSpace
          .filter(
            (space: any) =>
              !space.space.deleted_at &&
              !space.space?.projects?.some((project: any) => project.deleted_at)
          )
          .map((space, index) => ({
            id: space.space.id,
            name: space.space.name,
            value: space.count,
            color: `hsl(${index * 50}, 70%, 50%)`,
          }));
  const total = pieData.reduce((sum, d) => sum + d.value, 0);

  const handleSpaceMouseEnter = (entry: any, event: any) => {
    setSpaceHoveredSegment(entry);
    setTooltipData(entry);
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleSpaceMouseLeave = () => {
    setSpaceHoveredSegment(null);
    setTooltipData(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (tooltipData) {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }
  };

  if (pieData.length === 0) {
    return (
      <Card className="shadow-sm workspace-header-bg border workspace-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-bold">By Space</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-1 rounded text-xs border ${
                view === "tasks"
                  ? "bg-emerald-500 text-white"
                  : "workspace-border"
              }`}
              onClick={() => setView("tasks")}
            >
              Tasks
            </button>
            <button
              className={`px-2 py-1 rounded text-xs border ${
                view === "projects"
                  ? "bg-emerald-500 text-white"
                  : "workspace-border"
              }`}
              onClick={() => setView("projects")}
            >
              Projects
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-gray-500">No space data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="shadow-sm workspace-header-bg border workspace-border"
      onMouseMove={handleMouseMove}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-bold">By Space</CardTitle>
          <p className="text-xs text-muted-foreground">Distribution</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-1 rounded text-xs border ${
              view === "tasks"
                ? "bg-emerald-500 text-white"
                : "workspace-border"
            }`}
            onClick={() => setView("tasks")}
          >
            Tasks
          </button>
          <button
            className={`px-2 py-1 rounded text-xs border ${
              view === "projects"
                ? "bg-emerald-500 text-white"
                : "workspace-border"
            }`}
            onClick={() => setView("projects")}
          >
            Projects
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-lg font-bold mb-1">{total}</div>
          <div className="text-xs text-muted-foreground">
            Total {view === "tasks" ? "Tasks" : "Projects"}
          </div>
        </div>

        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={60}
                paddingAngle={5}
                cornerRadius={5}
                dataKey="value"
                onMouseEnter={handleSpaceMouseEnter}
                onMouseLeave={handleSpaceMouseLeave}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center text - changes based on hover */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {spaceHoveredSegment ? (
              <>
                <div className="text-xl font-bold text-gray-900">
                  {spaceHoveredSegment.value}
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {spaceHoveredSegment.name}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">
                  {view === "tasks" ? "Tasks" : "Projects"}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Space breakdown list */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pieData.map((space) => (
            <div
              key={space.id}
              className="flex items-center gap-3 p-2 bg-gray-50/50 rounded-lg workspace-secondary-sidebar-bg"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: space.color }}
              />
              <span className="text-sm font-medium">{space.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom tooltip positioned outside chart */}
      {tooltipData && mousePosition.x > 0 && (
        <div
          className="fixed rounded-sm p-1 shadow-lg pointer-events-none"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 30,
            backgroundColor: tooltipData.color,
            zIndex: 9999,
          }}
        >
          <p className="text-[10px] text-white">
            {tooltipData.name} : {tooltipData.value}
          </p>
        </div>
      )}
    </Card>
  );
}
