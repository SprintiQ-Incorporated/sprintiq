"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PersonaDraft {
  name: string;
  description: string;
  role: string;
  domain: string;
  tech_savviness: number;
  usage_frequency: "daily" | "weekly" | "monthly";
  priority_level: "high" | "medium" | "low";
}

const TECH_SAVVINESS_LABELS: Record<number, string> = {
  1: "Novice",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

interface Props {
  draft: PersonaDraft;
  onChange: (next: PersonaDraft) => void;
}

export function PersonaFields({ draft, onChange }: Props) {
  const update = (patch: Partial<PersonaDraft>) =>
    onChange({ ...draft, ...patch });

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label htmlFor="persona-name">Name *</Label>
        <Input
          id="persona-name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={255}
          placeholder="e.g. Data Scientist Sarah"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="persona-description">Description *</Label>
        <Textarea
          id="persona-description"
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          rows={4}
          maxLength={5000}
          placeholder="Pain points, goals, daily context"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="persona-role">Role</Label>
          <Input
            id="persona-role"
            value={draft.role}
            onChange={(e) => update({ role: e.target.value })}
            maxLength={255}
            placeholder="e.g. Senior Data Scientist"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="persona-domain">Domain</Label>
          <Input
            id="persona-domain"
            value={draft.domain}
            onChange={(e) => update({ domain: e.target.value })}
            maxLength={255}
            placeholder="e.g. Fintech"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Tech savviness</Label>
          <Select
            value={String(draft.tech_savviness)}
            onValueChange={(v) => update({ tech_savviness: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} — {TECH_SAVVINESS_LABELS[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Usage frequency</Label>
          <Select
            value={draft.usage_frequency}
            onValueChange={(v) =>
              update({ usage_frequency: v as PersonaDraft["usage_frequency"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority level</Label>
          <Select
            value={draft.priority_level}
            onValueChange={(v) =>
              update({ priority_level: v as PersonaDraft["priority_level"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
