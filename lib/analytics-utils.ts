/* eslint-disable @typescript-eslint/no-unused-vars */
import { TeamMember } from "@/types";
import { getColorByIndex } from "@/lib/utils";

interface UserStory {
  id: string;
  title: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  assignedTeamMember?: TeamMember;
}

export function getAvatarInitials(
  name: string | null,
  email: string | null
): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0]?.toUpperCase() || "";
  }
  if (email) {
    return email[0]?.toUpperCase() || "";
  }
  return "?";
}

export function exportToCSV(stories: UserStory[], filename: string = 'stories') {
  const headers = ['Title', 'Priority', 'Assignee', 'Assignee Role'];
  const rows = stories.map(s => [
    `"${s.title.replace(/"/g, '""')}"`,
    s.priority || 'None',
    s.assignedTeamMember?.name || 'Unassigned',
    s.assignedTeamMember?.role || ''
  ]);
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
