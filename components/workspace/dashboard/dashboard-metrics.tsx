"use client";

import React from "react";
import { MetricCard } from "./metric-card";
import {
  FileText,
  BarChart3,
  Users,
  Clock,
} from "lucide-react";

interface DashboardMetricsProps {
  activeStories?: number;
  storyPoints?: number;
  teamMembers?: number;
  totalCapacity?: number;
  className?: string;
}

export function DashboardMetrics({
  activeStories = 0,
  storyPoints = 0,
  teamMembers = 0,
  totalCapacity = 0,
  className,
}: DashboardMetricsProps) {
  const metrics = [
    {
      id: 1,
      label: "Active Stories",
      value: activeStories,
      icon: <FileText className="w-6 h-6" />,
      color: "green" as const,
      trend: activeStories > 0 ? { value: 12, isPositive: true } : undefined,
    },
    {
      id: 2,
      label: "Story Points",
      value: storyPoints,
      icon: <BarChart3 className="w-6 h-6" />,
      color: "blue" as const,
      trend: storyPoints > 0 ? { value: 8, isPositive: true } : undefined,
    },
    {
      id: 3,
      label: "Team Members",
      value: teamMembers,
      icon: <Users className="w-6 h-6" />,
      color: "purple" as const,
    },
    {
      id: 4,
      label: "Total Capacity",
      value: totalCapacity,
      icon: <Clock className="w-6 h-6" />,
      color: "orange" as const,
      trend:
        totalCapacity > 0 ? { value: 5, isPositive: false } : undefined,
    },
  ];

  return (
    <div className={className}>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            color={metric.color}
            trend={metric.trend}
          />
        ))}
      </div>
    </div>
  );
}
