"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Mail, Briefcase, Building2, Clock } from "lucide-react";

interface MemberCardProps {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  initials?: string;
  jobTitle?: string;
  department?: string;
  workHours?: string;
  status: "Active" | "Remote" | "Pending" | "Inactive" | "Unregistered";
  onClick?: () => void;
  className?: string;
  // Bulk selection props
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export function MemberCard({
  id,
  name,
  email,
  avatar,
  initials,
  jobTitle,
  department,
  workHours,
  status,
  onClick,
  className,
  selectable = false,
  selected = false,
  onSelectionChange,
}: MemberCardProps) {
  const getStatusClass = (status: string): string => {
    switch (status) {
      case "Active":
        return "status-badge active";
      case "Remote":
        return "status-badge remote";
      case "Pending":
        return "status-badge pending";
      case "Inactive":
        return "status-badge inactive";
      case "Unregistered":
        return "status-badge unregistered";
      default:
        return "status-badge";
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(id, checked);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking the checkbox area, don't trigger card click
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return;
    }
    onClick?.();
  };

  return (
    <Card
      className={cn(
        "member-card",
        onClick && "cursor-pointer",
        selected && "ring-2 ring-primary-500 bg-primary-50/50",
        className
      )}
      onClick={handleCardClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          {/* Selection checkbox */}
          {selectable && (
            <div
              data-checkbox
              className="flex items-center mr-3 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={handleCheckboxChange}
                aria-label={`Select ${name}`}
              />
            </div>
          )}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-12 h-12">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback className="bg-primary-100 text-primary-700 font-semibold">
                {initials ||
                  name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{name}</h4>
              <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {email}
              </p>
            </div>
          </div>
          {initials && (
            <div className="member-initials w-10 h-10 flex-shrink-0">
              {initials}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="member-details mb-3">
          {jobTitle && (
            <>
              <div className="label flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                Job Title:
              </div>
              <div className="value truncate">{jobTitle}</div>
            </>
          )}
          {department && (
            <>
              <div className="label flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Department:
              </div>
              <div className="value truncate">{department}</div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {workHours && (
              <span className="text-xs px-2 py-1 bg-gray-100 rounded flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {workHours}
              </span>
            )}
          </div>
          <span className={getStatusClass(status)}>{status}</span>
        </div>
      </CardContent>
    </Card>
  );
}
