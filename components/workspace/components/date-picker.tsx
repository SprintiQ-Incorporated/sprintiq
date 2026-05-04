import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  addWeeks,
  isBefore,
  isAfter,
  addMonths,
  subMonths,
} from "date-fns";
import React from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface DatePickerProps {
  startDate: string | null;
  dueDate: string | null;
  onDateChange: (startDate: Date | null, dueDate: Date | null) => void;
}

export function DatePicker({
  startDate,
  dueDate,
  onDateChange,
}: DatePickerProps) {
  const today = new Date();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSelectingStartDate, setIsSelectingStartDate] = React.useState(true);
  const [currentMonth, setCurrentMonth] = React.useState(today);
  const [tempStartDate, setTempStartDate] = React.useState<Date | null>(
    startDate ? parseISO(startDate) : null
  );
  const [tempDueDate, setTempDueDate] = React.useState<Date | null>(
    dueDate ? parseISO(dueDate) : null
  );

  const [startDateInput, setStartDateInput] = React.useState(
    startDate ? format(parseISO(startDate), "MMM d, yyyy") : ""
  );
  const [dueDateInput, setDueDateInput] = React.useState(
    dueDate ? format(parseISO(dueDate), "MMM d, yyyy") : ""
  );

  const handleDateSelect = (date: Date | null) => {
    if (isSelectingStartDate) {
      if (date) {
        // If due date exists and is before new start date, clear it
        if (tempDueDate && isAfter(date, tempDueDate)) {
          setTempDueDate(null);
          setDueDateInput("");
        }
        setTempStartDate(date);
        setStartDateInput(format(date, "MMM d, yyyy"));
      } else {
        setTempStartDate(null);
        setStartDateInput("");
      }
    } else {
      if (date) {
        // If start date exists and is after new due date, clear it
        if (tempStartDate && isBefore(date, tempStartDate)) {
          setTempStartDate(null);
          setStartDateInput("");
        }
        setTempDueDate(date);
        setDueDateInput(format(date, "MMM d, yyyy"));
      } else {
        setTempDueDate(null);
        setDueDateInput("");
      }
    }
  };

  const handleInputFocus = (isStart: boolean) => {
    setIsSelectingStartDate(isStart);
    setIsOpen(true);
  };

  const handleDone = () => {
    setIsOpen(false);
    onDateChange(tempStartDate, tempDueDate);
  };

  const handleClearDate = (isStart: boolean) => {
    if (isStart) {
      setTempStartDate(null);
      setStartDateInput("");
    } else {
      setTempDueDate(null);
      setDueDateInput("");
    }
    onDateChange(isStart ? null : tempStartDate, !isStart ? null : tempDueDate);
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // Function to determine if a date is within the selected range
  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempDueDate) return false;
    return date >= tempStartDate && date <= tempDueDate;
  };

  const quickSelections = [
    { label: "Today", date: today, time: "Wed" },
    { label: "Later", date: today, time: "6:51 pm" },
    { label: "Tomorrow", date: addDays(today, 1), time: "Thu" },
    {
      label: "This weekend",
      date: addDays(startOfWeek(today, { weekStartsOn: 1 }), 5),
      time: "Sat",
    },
    { label: "Next week", date: addWeeks(today, 1), time: "Mon" },
    { label: "Next weekend", date: addWeeks(today, 1), time: "14 Jun" },
    { label: "2 weeks", date: addWeeks(today, 2), time: "18 Jun" },
    { label: "4 weeks", date: addWeeks(today, 4), time: "2 Jul" },
  ];

  return (
    <div className="flex flex-col gap-0 w-full">
      <div className="flex flex-row justify-between gap-3 w-full border-b workspace-border pb-2">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Select a start date"
            className="w-32 h-7 workspace-border text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-2 focus:workspace-ring"
            value={startDateInput}
            onFocus={() => handleInputFocus(true)}
            readOnly
          />
          <button
            onClick={() => handleClearDate(true)}
            className="text-workspace-text-muted hover:text-workspace-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Select a due date"
            className="w-32 h-7 workspace-border text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-2 focus:workspace-ring"
            value={dueDateInput}
            onFocus={() => handleInputFocus(false)}
            readOnly
          />
          <button
            onClick={() => handleClearDate(false)}
            className="text-workspace-text-muted hover:text-workspace-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="flex flex-row gap-0 w-full">
          <div className="border-r workspace-border flex flex-col w-full pr-2 pt-2">
            <div className="grid grid-rows-8 gap-0">
              {quickSelections.map((selection) => (
                <Button
                  key={selection.label}
                  variant="ghost"
                  size="sm"
                  className="flex justify-between text-xs h-7 px-3 gap-2 rounded-md hover:workspace-hover "
                  onClick={() => handleDateSelect(selection.date)}
                >
                  <span className="workspace-text">{selection.label}</span>
                  <span className="workspace-text-muted">{selection.time}</span>
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 p-2 text-xs workspace-primary text-white hover:workspace-primary-hover mt-auto"
              onClick={handleDone}
            >
              Done
            </Button>
          </div>

          <div className="flex flex-col gap-0">
            <div className="flex items-center justify-between px-3 py-2 border-b workspace-border">
              <div className="flex items-center gap-2">
                <span className="text-xs workspace-sidebar-text">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:workspace-hover"
                  onClick={() => {
                    setCurrentMonth(today);
                    handleDateSelect(today);
                  }}
                >
                  Today
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 workspace-sidebar-text hover:workspace-hover"
                  onClick={handlePrevMonth}
                >
                  ▲
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 workspace-sidebar-text hover:workspace-hover"
                  onClick={handleNextMonth}
                >
                  ▼
                </Button>
              </div>
            </div>
            <Calendar
              mode="single"
              selected={
                isSelectingStartDate
                  ? tempStartDate || undefined
                  : tempDueDate || undefined
              }
              onSelect={(date) => date && handleDateSelect(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="p-2"
              showOutsideDays={false}
              fixedWeeks
              modifiers={{
                range: (date) => isDateInRange(date),
              }}
              modifiersStyles={{
                selected: {
                  backgroundColor: "rgb(var(--workspace-primary-500))",
                  color: "white",
                },
                range: {
                  backgroundColor: "rgb(var(--workspace-component-bg))",
                  borderRadius: "0",
                },
              }}
              styles={{
                head_row: { marginBottom: "4px" },
                head_cell: {
                  width: "32px",
                  fontSize: "0.75rem",
                  color: "rgb(var(--workspace-text-muted))",
                  fontWeight: "normal",
                  textTransform: "uppercase",
                },
                cell: {
                  width: "32px",
                  height: "32px",
                  padding: "0",
                },
                button: {
                  width: "28px",
                  height: "28px",
                  fontSize: "0.75rem",
                  color: "rgb(var(--workspace-text))",
                },
                nav: { display: "none" },
                caption: { display: "none" },
              }}
              classNames={{
                day_selected:
                  "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
                day_today:
                  "bg-red-500 text-white hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white",
                day: "hover:workspace-hover text-workspace-text",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
