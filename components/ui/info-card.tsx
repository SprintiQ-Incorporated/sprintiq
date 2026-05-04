"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  short: string;
  full: string;
  variant?: "light" | "dark";
  className?: string;
}

export function InfoCard({
  icon,
  title,
  short,
  full,
  variant: _variant = "light",
  className,
}: InfoCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-sm transition-all",
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
        {icon}
      </div>

      {/* Title */}
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      {/* Short Copy */}
      <p className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-300">
        {short}
      </p>

      {/* Full Copy */}
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {full}
      </p>
    </div>
  );
}

export interface InfoCardData {
  icon: React.ReactNode;
  title: string;
  short: string;
  full: string;
}

export interface InfoCardGridProps {
  cards: InfoCardData[];
  variant?: "light" | "dark";
  className?: string;
}

export function InfoCardGrid({
  cards,
  variant = "light",
  className,
}: InfoCardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
        className
      )}
    >
      {cards.map((card, index) => (
        <InfoCard
          key={index}
          icon={card.icon}
          title={card.title}
          short={card.short}
          full={card.full}
          variant={variant}
        />
      ))}
    </div>
  );
}
