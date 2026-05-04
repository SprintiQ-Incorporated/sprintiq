"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, PieChart as PieChartIcon } from "lucide-react";

interface CompletionData {
  name: string;
  value: number;
  color: string;
}

interface CompletionRateChartProps {
  completed?: number;
  inProgress?: number;
  pending?: number;
  className?: string;
}

export function CompletionRateChart({
  completed = 0,
  inProgress = 0,
  pending = 0,
  className,
}: CompletionRateChartProps) {
  const total = completed + inProgress + pending;

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Completion Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PieChartIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">No task data yet</p>
            <p className="text-xs mt-1">Completion rates appear when tasks are added to sprints</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  const completionRate = (total > 0 ? (completed / total) * 100 : 0).toFixed(1);

  const data: CompletionData[] = [
    { name: "Completed", value: completed, color: "#10b981" },
    { name: "In Progress", value: inProgress, color: "#f59e0b" },
    { name: "Pending", value: pending, color: "#6b7280" },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Completion Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 text-center">
            <div className="text-4xl font-bold text-green-600">{completionRate}%</div>
            <div className="text-sm text-gray-500 mt-1">
              {completed} of {total} stories completed
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 w-full">
            {data.map((item) => (
              <div key={item.name} className="text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: item.color }}
                />
                <div className="text-xs text-gray-500">{item.name}</div>
                <div className="text-lg font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
