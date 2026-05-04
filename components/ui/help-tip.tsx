"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  iconClassName?: string;
}

export function HelpTip({
  content,
  side = "top",
  align = "center",
  className,
  iconClassName,
}: HelpTipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className
            )}
            aria-label="Help"
          >
            <HelpCircle className={cn("h-4 w-4", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs text-sm"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface HelpTipWithLabelProps extends HelpTipProps {
  label: string;
  labelClassName?: string;
}

export function HelpTipWithLabel({
  label,
  content,
  side = "top",
  align = "center",
  className,
  labelClassName,
  iconClassName,
}: HelpTipWithLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={labelClassName}>{label}</span>
      <HelpTip
        content={content}
        side={side}
        align={align}
        iconClassName={iconClassName}
      />
    </span>
  );
}
