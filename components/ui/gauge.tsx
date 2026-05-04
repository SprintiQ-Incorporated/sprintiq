"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

interface GaugeProps {
  value: number; // Percentage value (0-100)
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  backgroundColor?: string;
}

const Gauge = React.forwardRef<HTMLDivElement, GaugeProps>(
  (
    {
      value,
      label,
      className,
      size = "md",
      color = "#1E90FF",
      backgroundColor = "#F0F0F0",
    },
    ref
  ) => {
    // Ensure value is between 0 and 100
    const clampedValue = Math.max(0, Math.min(100, value));

    // Size configurations
    const sizeConfig = {
      sm: { width: 80, height: 40, fontSize: "text-lg", labelSize: "text-xs" },
      md: {
        width: 120,
        height: 60,
        fontSize: "text-2xl",
        labelSize: "text-sm",
      },
      lg: {
        width: 150,
        height: 150,
        fontSize: "text-2xl",
        labelSize: "text-md",
      },
    };

    const config = sizeConfig[size];

    // Prepare data for RadialBar
    const data = [
      {
        name: "background",
        value: 100,
        fill: backgroundColor,
      },
      {
        name: "progress",
        value: clampedValue,
        fill: color,
      },
    ];

    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center", className)}
        style={{ width: config.width, height: config.height }}
      >
        <div
          className="relative"
          style={{ width: config.width, height: config.height }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              data={data}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={10} background />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center text - percentage and label */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center"
            )}
          >
            <span className={cn(config.fontSize, "font-bold")}>
              {Math.round(clampedValue)}%
            </span>
            {label && (
              <span className={cn(config.labelSize, "font-normal")}>
                {label}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);

Gauge.displayName = "Gauge";

export { Gauge };
