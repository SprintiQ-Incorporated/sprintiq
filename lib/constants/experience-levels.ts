// lib/constants/experience-levels.ts

export const EXPERIENCE_LEVELS = [
  {
    id: "entry-level",
    name: "Entry-Level (<1 yr)",
    value: "entry-level",
    minYears: 0,
    maxYears: 1,
    description: "New to the field, learning fundamentals"
  },
  {
    id: "junior",
    name: "Junior (1-3 yrs)",
    value: "junior",
    minYears: 1,
    maxYears: 3,
    description: "Building core skills, needs guidance"
  },
  {
    id: "mid-level",
    name: "Mid-Level (3-5 yrs)",
    value: "mid-level",
    minYears: 3,
    maxYears: 5,
    description: "Independent contributor, solid fundamentals"
  },
  {
    id: "senior",
    name: "Senior (5-10 yrs)",
    value: "senior",
    minYears: 5,
    maxYears: 10,
    description: "Expert in domain, mentors others"
  },
  {
    id: "lead",
    name: "Lead (10+ yrs)",
    value: "lead",
    minYears: 10,
    maxYears: null,
    description: "Strategic leader, drives technical direction"
  },
] as const;

export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];
export type ExperienceLevelValue = ExperienceLevel['value'];

// Helper function to get level by value
export function getExperienceLevelByValue(value: string): ExperienceLevel | undefined {
  return EXPERIENCE_LEVELS.find(level => level.value === value);
}

// Helper to get display name from value
export function getExperienceLevelName(value: string): string {
  return getExperienceLevelByValue(value)?.name ?? value;
}
