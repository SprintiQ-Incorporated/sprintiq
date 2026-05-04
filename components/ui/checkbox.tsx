"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  variant?: "workspace" | null;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant, ...props }, ref) => {
  const textColorClass =
    variant === "workspace" ? "text-workspace-primary" : "text-primary";
  const borderColorClass =
    variant === "workspace" ? "border-workspace-primary" : "border-primary";
  const focusRingClass =
    variant === "workspace"
      ? "focus-visible:workspace-ring data-[state=checked]:workspace-primary-light"
      : "focus-visible:ring-ring data-[state=checked]:bg-primary";

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        borderColorClass,
        textColorClass,
        focusRingClass,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
