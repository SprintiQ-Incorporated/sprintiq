"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { isMobileDevice } from "@/lib/utils/device-detection";

interface MobileDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
}

/**
 * Mobile-optimized date picker component
 * 
 * - On mobile: Uses native HTML5 date input for better UX
 * - On desktop: Uses Calendar component with popover
 */
export function MobileDatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  minDate,
  className,
}: MobileDatePickerProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Format date for native input (YYYY-MM-DD)
  const formatForNativeInput = (date: Date | undefined): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Parse native input value to Date
  const parseNativeInput = (value: string): Date | undefined => {
    if (!value) return undefined;
    const date = new Date(value + "T00:00:00");
    return isNaN(date.getTime()) ? undefined : date;
  };

  // Handle native input change
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = parseNativeInput(e.target.value);
    onDateChange(newDate);
  };

  // Mobile: Native HTML5 date input
  if (isMobile) {
    return (
      <input
        type="date"
        value={formatForNativeInput(date)}
        onChange={handleNativeChange}
        disabled={disabled}
        min={minDate ? formatForNativeInput(minDate) : undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
    );
  }

  // Desktop: Calendar component with popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
