"use client";

/**
 * Interactive Component Playground
 *
 * Allows users to:
 * - Adjust component props via UI controls
 * - See real-time updates
 * - Copy code with current prop values
 */

import React, { useState } from "react";
import { Settings, Copy, CheckCircle2, RotateCcw } from "lucide-react";
import { AnalyticsMetricCard } from "@/components/workspace/analytics/analytics-metric-card";

interface PlaygroundProps {
  title: string;
  description: string;
}

export function InteractivePlayground({ title, description }: PlaygroundProps) {
  // Metric Card Playground State
  const [metricTitle, setMetricTitle] = useState("Completed Stories");
  const [metricValue, setMetricValue] = useState(48);
  const [trendValue, setTrendValue] = useState(12);
  const [trendDirection, setTrendDirection] = useState<"up" | "down">("up");
  const [isPositive, setIsPositive] = useState(true);
  const [color, setColor] = useState<"green" | "blue" | "purple" | "orange" | "red">("green");
  const [subtitle, setSubtitle] = useState("");

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = generateCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setMetricTitle("Completed Stories");
    setMetricValue(48);
    setTrendValue(12);
    setTrendDirection("up");
    setIsPositive(true);
    setColor("green");
    setSubtitle("");
  };

  const generateCode = () => {
    return `<AnalyticsMetricCard
  title="${metricTitle}"
  value={${metricValue}}
  trend={{
    value: ${trendValue},
    direction: "${trendDirection}",
    isPositive: ${isPositive}
  }}
  color="${color}"${subtitle ? `\n  subtitle="${subtitle}"` : ""}
  icon={<CheckCircle2 className="h-5 w-5" />}
/>`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-primary-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Settings className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
        {/* Controls Panel */}
        <div className="p-6 space-y-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Controls
            </h4>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          {/* Title Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={metricTitle}
              onChange={(e) => setMetricTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter metric title"
            />
          </div>

          {/* Value Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Value: {metricValue}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={metricValue}
              onChange={(e) => setMetricValue(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          {/* Trend Value Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trend Value: {trendValue}
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={trendValue}
              onChange={(e) => setTrendValue(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>50</span>
            </div>
          </div>

          {/* Trend Direction Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trend Direction
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTrendDirection("up")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  trendDirection === "up"
                    ? "bg-primary-500 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Up
              </button>
              <button
                onClick={() => setTrendDirection("down")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  trendDirection === "down"
                    ? "bg-primary-500 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Down
              </button>
            </div>
          </div>

          {/* Trend Sentiment Control */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPositive}
                onChange={(e) => setIsPositive(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Trend is Positive
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Controls whether the trend is shown as good (green) or bad (red)
            </p>
          </div>

          {/* Color Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(["green", "blue", "purple", "orange", "red"] as const).map(
                (c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-10 rounded-md border-2 transition-all ${
                      color === c
                        ? "border-gray-900 scale-105 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{
                      backgroundColor:
                        c === "green"
                          ? "#10b981"
                          : c === "blue"
                          ? "#3b82f6"
                          : c === "purple"
                          ? "#8b5cf6"
                          : c === "orange"
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                    title={c}
                  />
                )
              )}
            </div>
          </div>

          {/* Subtitle Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle (Optional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., points/sprint"
            />
          </div>
        </div>

        {/* Preview Panel */}
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Live Preview
            </h4>
            <div className="flex justify-center items-center min-h-[200px]">
              <div className="w-full max-w-sm">
                <AnalyticsMetricCard
                  title={metricTitle}
                  value={metricValue}
                  trend={{
                    value: trendValue,
                    direction: trendDirection,
                    isPositive: isPositive,
                  }}
                  color={color}
                  subtitle={subtitle || undefined}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Generated Code
              </h4>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{generateCode()}</code>
              </pre>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Adjust the controls on the left to see how
              props affect the component in real-time. The code updates
              automatically!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
