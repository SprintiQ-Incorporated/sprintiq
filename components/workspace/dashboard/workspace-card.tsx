"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Folder, Users, GitBranch, Calendar } from "lucide-react";

interface WorkspaceMember {
  id: string;
  name: string;
  avatar?: string;
}

interface WorkspaceCardProps {
  id: string;
  name: string;
  type: string;
  initial: string;
  color?: string;
  projects: number;
  members: number;
  sprints: number;
  dueTime?: string;
  memberAvatars?: WorkspaceMember[];
  onClick?: () => void;
  className?: string;
}

export function WorkspaceCard({
  name,
  type,
  initial,
  color = "bg-primary-500",
  projects,
  members,
  sprints,
  dueTime,
  memberAvatars = [],
  onClick,
  className,
}: WorkspaceCardProps) {
  return (
    <div
      className={cn("workspace-card-container", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("workspace-icon", color)}>
            <span className="text-lg">{initial}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">{name}</h3>
            <p className="text-sm text-gray-500">{type}</p>
          </div>
        </div>
        {dueTime && (
          <Badge variant="default" className="bg-green-100 text-green-700">
            <Calendar className="w-3 h-3 mr-1" />
            {dueTime}
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="workspace-stats mb-3">
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

      {/* Member Avatars */}
      {memberAvatars.length > 0 && (
        <div className="avatar-group">
          {memberAvatars.slice(0, 5).map((member) => (
            <Avatar key={member.id} className="avatar w-8 h-8">
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
          {memberAvatars.length > 5 && (
            <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
              +{memberAvatars.length - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
