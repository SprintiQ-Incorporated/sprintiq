"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart as BarChartIcon } from "lucide-react";

interface VelocityDataPoint {
  sprint: string;
  planned: number;
  completed: number;
  velocity: number;
}

interface VelocityChartProps {
  data?: VelocityDataPoint[];
  className?: string;
}

export function VelocityChart({ data = [], className }: VelocityChartProps) {
  // Check if we have real data
  const hasData = data && data.length > 0;

  // Show empty state if no data
  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Team Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
            <BarChartIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Velocity Data Yet</h3>
            <p className="text-sm text-gray-600 max-w-md">
              Complete your first sprint with story points to see velocity analytics. 
              Velocity shows how many story points your team completes per sprint.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate trend
  const recentVelocity = data.slice(-3).map((d) => d.velocity);
  const avgRecent = recentVelocity.reduce((a, b) => a + b, 0) / recentVelocity.length;
  const previousVelocity = data.slice(-6, -3).map((d) => d.velocity);
  const avgPrevious = previousVelocity.length > 0 
    ? previousVelocity.reduce((a, b) => a + b, 0) / previousVelocity.length 
    : avgRecent;
  const trend = avgRecent > avgPrevious ? "up" : avgRecent < avgPrevious ? "down" : "neutral";
  const trendPercent = avgPrevious > 0 
    ? Math.abs(((avgRecent - avgPrevious) / avgPrevious) * 100).toFixed(1)
    : "0.0";

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Team Velocity</CardTitle>
          <div className="flex items-center gap-2">
            {trend === "up" ? (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-semibold">+{trendPercent}%</span>
              </div>
            ) : trend === "down" ? (
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-semibold">-{trendPercent}%</span>
              </div>
            ) : (
              <span className="text-sm text-gray-500">Steady</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="sprint" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="planned" fill="#cbd5e1" name="Planned" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
