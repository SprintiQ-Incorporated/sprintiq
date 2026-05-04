import type { GeneratedStory } from "@/components/story-generator/StoryCard";

export interface SprintSummary {
  totalPoints: number;
  totalHours: number;
  skillGaps: number;
  storyCount: number;
}

export function calculateSprintSummary(stories: GeneratedStory[]): SprintSummary {
  const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const totalHours = stories.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);
  const skillGaps = stories.filter(
    (s) => s.skillMatch !== undefined && s.skillMatch < 50
  ).length;

  return {
    totalPoints,
    totalHours,
    skillGaps,
    storyCount: stories.length,
  };
}

export function exportToJSON(stories: GeneratedStory[]): void {
  const data = JSON.stringify(stories, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stories-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(stories: GeneratedStory[]): void {
  const headers = [
    "Title",
    "Role",
    "Want",
    "Benefit",
    "Story Points",
    "Estimated Hours",
    "Tags",
    "Acceptance Criteria",
  ];
  const rows = stories.map((s) => [
    s.title,
    s.role,
    s.want,
    s.benefit,
    s.storyPoints,
    s.estimatedHours,
    s.tags.join("; "),
    s.acceptanceCriteria.join("; "),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stories-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyStoriesToClipboard(stories: GeneratedStory[]): void {
  const text = stories
    .map(
      (s, i) =>
        `${i + 1}. ${s.title}\n   As a ${s.role}, I want ${s.want}, so that ${s.benefit}.\n   Points: ${s.storyPoints} | Hours: ${s.estimatedHours}h`
    )
    .join("\n\n");

  navigator.clipboard.writeText(text);
}
