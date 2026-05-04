"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "active" | "pending" | "inactive" | "remote" | "success" | "warning" | "error" | "info";
  className?: string;
}

export function StatusBadge({ status, type = "active", className }: StatusBadgeProps) {
  return (
    <span className={cn("status-badge", type, className)}>
      {status}
    </span>
  );
}
