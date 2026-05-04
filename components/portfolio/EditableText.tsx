"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder = "Enter text...",
  maxLength = 100,
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (!disabled) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave(trimmedValue);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        placeholder={placeholder}
        className={cn(
          "h-7 px-2 py-1 text-sm bg-slate-800 border-slate-600 text-white focus:ring-emerald-500 focus:border-emerald-500",
          inputClassName
        )}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={cn(
        "cursor-text hover:bg-slate-700/50 rounded px-1 -mx-1 transition-colors",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      title={disabled ? undefined : "Double-click to edit"}
    >
      {value || placeholder}
    </span>
  );
}
