"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CustomizeListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVisibleColumns: Set<string>;
  onSave: (newVisibleColumns: Set<string>) => void;
}

const allAvailableColumns = [
  { key: "assignee", label: "Assignee" },
  { key: "dueDate", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "subtasks", label: "Subtasks" },
  { key: "createdAt", label: "Date Created" },
  { key: "sprints", label: "Sprints" },
  { key: "sprintPoints", label: "Sprint Points" },
  { key: "createdBy", label: "Created By" },
];

export default function CustomizeListModal({
  open,
  onOpenChange,
  currentVisibleColumns,
  onSave,
}: CustomizeListModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(currentVisibleColumns)
  );

  useEffect(() => {
    setSelectedColumns(new Set(currentVisibleColumns));
  }, [currentVisibleColumns, open]);

  const handleCheckboxChange = (key: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    onSave(selectedColumns);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customize List Columns</DialogTitle>
          <DialogDescription className="sr-only">
            Select which columns to display in your task list view
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {allAvailableColumns.map((column) => (
            <div key={column.key} className="flex items-center space-x-2">
              <Checkbox
                id={`column-${column.key}`}
                variant="workspace"
                checked={selectedColumns.has(column.key)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(column.key, checked as boolean)
                }
              />
              <Label htmlFor={`column-${column.key}`}>{column.label}</Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="workspace">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
