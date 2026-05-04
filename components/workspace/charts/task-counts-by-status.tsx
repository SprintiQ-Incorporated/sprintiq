"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { getStatusTypeChartColor } from "@/lib/utils";
import { ArrowUpRight, ChartPie } from "lucide-react";

interface TaskCountsByStatusProps {
  statusCounts: {
    name: string;
    color: string;
    count: number;
    percentage?: number;
  }[];
}

export default function TaskCountsByStatus({
  statusCounts,
}: TaskCountsByStatusProps) {
  const [statusHoveredSegment, setStatusHoveredSegment] = useState<any>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const statusPieData = statusCounts
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.name,
      value: s.count,
      color: getStatusTypeChartColor(s.name),
      percentage: s.percentage || 0,
    }));
  const statusTotal = statusPieData.reduce((sum, d) => sum + d.value, 0);

  const handleStatusMouseEnter = (entry: any, event: any) => {
    setStatusHoveredSegment(entry);
    setTooltipData(entry);
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleStatusMouseLeave = () => {
    setStatusHoveredSegment(null);
    setTooltipData(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (tooltipData) {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }
  };

  if (statusTotal === 0) {
    return (
      <Card className="shadow-sm workspace-header-bg border workspace-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-bold">Task Status</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution</p>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-600">0%</span>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-gray-500">No task data available</p>
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
        <CardTitle className="text-sm font-medium">Task Status</CardTitle>
        <div className="flex items-center bg-pink-500/10 rounded-md p-2">
          <ChartPie className="h-5 w-5 text-pink-500" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-2xl font-bold mb-1">{statusTotal}</div>
          <div className="text-xs text-muted-foreground">Total Tasks</div>
        </div>

        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={60}
                paddingAngle={5}
                cornerRadius={5}
                dataKey="value"
                onMouseEnter={handleStatusMouseEnter}
                onMouseLeave={handleStatusMouseLeave}
              >
                {statusPieData.map((entry, index) => (
                  <Cell key={`cell-status-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center text - changes based on hover */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {statusHoveredSegment ? (
              <>
                <div className="text-xl font-bold text-gray-900">
                  {statusHoveredSegment.value}
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {statusHoveredSegment.name}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold">{statusTotal}</div>
                <div className="text-xs text-muted-foreground">Total Tasks</div>
              </>
            )}
          </div>
        </div>
      </CardContent>

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
