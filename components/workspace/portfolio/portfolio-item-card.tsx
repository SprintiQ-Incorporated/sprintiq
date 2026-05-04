"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Folder,
  Users,
  GitBranch,
  Calendar,
  AlertCircle,
} from "lucide-react";

interface PortfolioItemMember {
  id: string;
  name: string;
  avatar?: string;
}

interface PortfolioItemProps {
  id: string;
  name: string;
  description?: string;
  type?: string;
  icon?: string;
  color?: string;
  projects: number;
  members: number;
  sprints: number;
  progress?: number;
  status?: "active" | "planning" | "on-hold" | "completed";
  dueDate?: string;
  memberAvatars?: PortfolioItemMember[];
  risk?: "low" | "medium" | "high";
  href?: string; // Direct link to the portfolio/space detail page
  onClick?: () => void;
  className?: string;
}

export function PortfolioItemCard({
  name,
  description,
  type = "General",
  icon,
  color = "bg-primary-500",
  projects,
  members,
  sprints,
  progress,
  status = "active",
  dueDate,
  memberAvatars = [],
  risk,
  href,
  onClick,
  className,
}: PortfolioItemProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="status-badge active">Active</Badge>;
      case "planning":
        return <Badge className="status-badge pending">Planning</Badge>;
      case "on-hold":
        return <Badge className="status-badge warning">On Hold</Badge>;
      case "completed":
        return <Badge className="status-badge success">Completed</Badge>;
      default:
        return <Badge className="status-badge">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk?: string) => {
    if (!risk) return null;
    switch (risk) {
      case "low":
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <AlertCircle className="w-3 h-3" />
            Low Risk
          </span>
        );
      case "medium":
        return (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-3 h-3" />
            Medium Risk
          </span>
        );
      case "high":
        return (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            High Risk
          </span>
        );
      default:
        return null;
    }
  };

  const cardContent = (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5",
        href && "group",
        className
      )}
      onClick={!href ? onClick : undefined}
      role={onClick && !href ? "button" : undefined}
      tabIndex={onClick && !href ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && !href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("workspace-icon", color)}>
              <span className="text-lg">
                {icon || name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold text-gray-900 truncate text-base",
                href && "group-hover:text-blue-600 transition-colors"
              )}>
                {name}
              </h3>
              <p className="text-sm text-gray-500">{type}</p>
            </div>
          </div>
          {getStatusBadge(status)}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress */}
        {progress !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Overall Progress</span>
              <span className="text-xs font-semibold text-gray-900">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1.5">
            <Folder className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{projects}</span> Projects
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{members}</span> Members
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{sprints}</span> Sprints
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {/* Member Avatars */}
          <div className="avatar-group">
            {memberAvatars.slice(0, 4).map((member) => (
              <Avatar key={member.id} className="avatar w-7 h-7">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback className="text-xs bg-primary-100 text-primary-700">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ))}
            {memberAvatars.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                +{memberAvatars.length - 4}
              </div>
            )}
            {memberAvatars.length === 0 && (
              <span className="text-xs text-gray-400">No members</span>
            )}
          </div>

          {/* Due Date or Risk */}
          <div className="flex items-center gap-3">
            {risk && getRiskBadge(risk)}
            {dueDate && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {dueDate}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Wrap in Link for direct navigation when href is provided
  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
