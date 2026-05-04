"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { InfoTooltip, InfoTooltipContent } from "./info-tooltip";

export interface AnalyticsTab {
  key: string;
  icon: React.ReactNode;
  title: string;
  short: string;
  full: string;
}

export interface AnalyticsTabBarProps {
  tabs: AnalyticsTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant?: "light" | "dark";
  className?: string;
}

export function AnalyticsTabBar({
  tabs,
  activeTab,
  onTabChange,
  variant = "light",
  className,
}: AnalyticsTabBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide bg-gray-50 dark:bg-gray-800/50",
        className
      )}
      role="tablist"
      aria-label="Analytics tabs"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const tooltipContent: InfoTooltipContent = {
          icon: tab.icon,
          title: tab.title,
          short: tab.short,
          full: tab.full,
        };

        return (
          <div key={tab.key} className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.key}-panel`}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                isActive
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <span className="flex-shrink-0">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.title}</span>
            </button>

            <InfoTooltip content={tooltipContent} variant={variant} />
          </div>
        );
      })}
    </div>
  );
}
