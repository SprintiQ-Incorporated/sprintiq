"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface CumulativeFlowDataPoint {
  date: string;
  done: number;
  inProgress: number;
  review: number;
  todo: number;
}

interface CumulativeFlowChartProps {
  data?: CumulativeFlowDataPoint[];
  className?: string;
}

export function CumulativeFlowChart({
  data = [],
  className,
}: CumulativeFlowChartProps) {
  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Cumulative Flow Diagram
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[350px] text-center px-4">
            <Activity className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Flow Data Yet</h3>
            <p className="text-sm text-gray-600 max-w-md">
              Start tracking work items to see the cumulative flow diagram.
              This chart shows work item distribution across statuses over time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Cumulative Flow Diagram
        </CardTitle>
        <p className="text-sm text-gray-500">Work item distribution over time</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="done"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              name="Done"
            />
            <Area
              type="monotone"
              dataKey="review"
              stackId="1"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              name="In Review"
            />
            <Area
              type="monotone"
              dataKey="inProgress"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              name="In Progress"
            />
            <Area
              type="monotone"
              dataKey="todo"
              stackId="1"
              stroke="#6b7280"
              fill="#6b7280"
              name="To Do"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
