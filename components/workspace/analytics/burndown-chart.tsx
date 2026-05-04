"use client";

import React from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

interface BurndownDataPoint {
  day: string;
  ideal: number;
  actual: number;
  remaining: number;
}

interface BurndownChartProps {
  data?: BurndownDataPoint[];
  sprintName?: string;
  className?: string;
}

export function BurndownChart({
  data = [],
  sprintName = "Current Sprint",
  className,
}: BurndownChartProps) {
  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Burndown Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
            <Flame className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Burndown Data Yet</h3>
            <p className="text-sm text-gray-600 max-w-md">
              Start a sprint with story points to see burndown analytics.
              The burndown chart tracks remaining work over the sprint duration.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestData = data[data.length - 1];
  const isOnTrack = latestData.actual <= latestData.ideal;
  const variance = Math.abs(latestData.actual - latestData.ideal);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Burndown Chart
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isOnTrack ? "default" : "destructive"}>
              {isOnTrack ? "On Track" : `${variance} pts behind`}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-gray-500">{sprintName}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} label={{ value: "Story Points", angle: -90, position: "insideLeft" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Ideal Burndown"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#colorActual)"
              name="Actual Progress"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
