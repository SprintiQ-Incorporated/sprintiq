"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  User,
  Edit,
  Trash2,
  Users2,
  Calendar,
  Code,
  Clock,
  Star,
  Building,
  Zap,
  Goal,
  Sparkles,
  Info,
  FolderKanban,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PersonaSvg } from "@/components/svg/PersonaSvg";
import AiCreateWizard from "@/components/workspace/persona-create-wizard";
import { ManagePersonaProjectsModal } from "@/components/workspace/modals/manage-persona-projects-modal";
import { Persona } from "@/lib/database-aliases";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import PersonaLoading from "./loading";


interface PersonaWithProjects extends Persona {
  project_count?: number;
}

export default function PersonaPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { user, session } = useAuth();
  const supabase = createClientSupabaseClient();

  const [personas, setPersonas] = useState<PersonaWithProjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [managingProjectsPersona, setManagingProjectsPersona] =
    useState<PersonaWithProjects | null>(null);

  useEffect(() => {
    // Only fetch when we have a valid session to prevent queries during token refresh failures
    if (workspaceId && user && session?.access_token) {
      fetchPersonas();
    }
  }, [workspaceId, user, session?.access_token]);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      setError(null);

      // Resolve workspace friendly ID → internal UUID
      // If the first query returns null (RLS denied due to stale session),
      // refresh the session and retry once before giving up.
      let workspaceData: { id: string } | null = null;

      const queryWorkspace = () =>
        supabase
          .from("workspaces")
          .select("id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

      const { data: firstTry, error: workspaceError } = await queryWorkspace();

      if (workspaceError) {
        setError(
          "Failed to load workspace. Please check your workspace access."
        );
        return;
      }

      if (!firstTry) {
        // Session may be stale — refresh and retry once
        await supabase.auth.getUser();
        const { data: retryData } = await queryWorkspace();
        workspaceData = retryData;
      } else {
        workspaceData = firstTry;
      }

      if (!workspaceData) {
        setError("Workspace not found. Try refreshing the page.");
        return;
      }

      // Now fetch personas using the workspace.id
      const { data, error } = await supabase
        .from("personas")
        .select(
          `
          *,
          created_by_profile:profiles!personas_created_by_fkey(id, full_name, avatar_url, email)
        `
        )
        .eq("workspace_id", workspaceData.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .returns<Persona[]>();

      if (error) {
        // Check if it's a table doesn't exist error
        if (
          error.message?.includes("relation") &&
          error.message?.includes("does not exist")
        ) {
          setError(
            "Personas table not found. Please run the database migration first."
          );
        } else if (error.message?.includes("permission denied")) {
          setError(
            "You don't have permission to access personas. Please check your workspace membership."
          );
        } else {
          setError(
            `Failed to load personas: ${error.message || "Unknown error"}`
          );
        }
        return;
      }

      // Batch fetch project counts for all personas (avoids N+1)
      const personaIds = (data || []).map((p) => p.id);
      const projectCountByPersona = new Map<string, number>();
      if (personaIds.length > 0) {
        const { data: ppData } = await supabase
          .from("project_personas")
          .select("persona_id")
          .in("persona_id", personaIds);
        (ppData || []).forEach((pp: any) => {
          projectCountByPersona.set(
            pp.persona_id,
            (projectCountByPersona.get(pp.persona_id) || 0) + 1
          );
        });
      }
      const personasWithCounts: PersonaWithProjects[] = (data || []).map(
        (persona) => ({
          ...persona,
          project_count: projectCountByPersona.get(persona.id) || 0,
        })
      );

      setPersonas(personasWithCounts);
    } catch {
      setError("An unexpected error occurred while loading personas.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    try {
      const { error } = await supabase
        .from("personas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", personaId);

      if (error) {
        setError(
          `Failed to delete persona: ${error.message || "Unknown error"}`
        );
        return;
      }

      setPersonas((prev) => prev.filter((p) => p.id !== personaId));
      setError(null); // Clear any previous errors
    } catch {
      setError("An unexpected error occurred while deleting the persona.");
    }
  };

  const filteredPersonas = personas.filter(
    (persona) =>
      (persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        persona.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !persona.deleted_at
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <PersonaLoading />;
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Personas</h1>
          <Badge variant="secondary">{personas.length} personas</Badge>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="workspace"
          className="text-xs p-2 h-8 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Persona
        </Button>
      </div>

      {/* Personas Explanation Banner */}
      <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
              What are Personas?
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              Personas represent your target users and stakeholders. When you generate user stories with Turbo,
              SprintIQ uses your personas to create more relevant and user-focused stories. Each persona&apos;s role,
              tech level, and priorities help the AI understand who will be using your features, resulting in
              better acceptance criteria and more actionable stories.
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Info className="w-3.5 h-3.5" />
                <span>Define roles like &quot;Product Manager&quot; or &quot;End User&quot;</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Zap className="w-3.5 h-3.5" />
                <span>Used in AI story generation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
            {error.includes("migration") && (
              <div className="mt-2">
                <p className="text-sm text-red-700">
                  To fix this, run the migration script:
                </p>
                <code className="block mt-1 p-2 bg-red-100 rounded text-xs">
                  ./scripts/run-personas-migration.sh
                </code>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filter */}
      <div className="flex items-center mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search personas..."
            variant="workspace"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 workspace-header-bg border workspace-border"
          />
        </div>
      </div>

      {/* Personas Grid */}
      {filteredPersonas.length === 0 ? (
        <div className="text-center py-12">
          <PersonaSvg
            color="currentColor"
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
          />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm ? "No personas found" : "No personas yet"}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm
              ? "Try adjusting your search terms"
              : "Create your first persona to get started with user story generation"}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="workspace"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Persona
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {filteredPersonas
            .filter((persona) => !persona.deleted_at)
            .map((persona) => (
              <Card
                key={persona.id}
                className="hover:shadow-md transition-shadow workspace-header-bg border workspace-border"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={persona.created_by_profile?.avatar_url || ""}
                        />
                        <AvatarFallback>
                          {persona.created_by_profile?.full_name ? (
                            getInitials(persona.created_by_profile.full_name)
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">
                          {persona.name}
                        </CardTitle>
                        <CardDescription>
                          Created by{" "}
                          {persona.created_by_profile?.full_name || "Unknown"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPersona(persona);
                          setIsCreateModalOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePersona(persona.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm workspace-text-muted line-clamp-4 mb-4">
                    {persona.description}
                  </p>

                  {/* Enhanced Persona Attributes */}
                  <div className="space-y-3">
                    {/* Tech Savviness */}
                    {persona.tech_savviness && (
                      <div className="flex items-center space-x-2">
                        <Code className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Tech Level:
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {persona.tech_savviness}/5
                        </Badge>
                      </div>
                    )}

                    {/* Usage Frequency */}
                    {persona.usage_frequency && (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Usage:
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs capitalize border workspace-border"
                        >
                          {persona.usage_frequency}
                        </Badge>
                      </div>
                    )}

                    {/* Priority Level */}
                    {persona.priority_level && (
                      <div className="flex items-center space-x-2">
                        <Goal className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Priority:
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            persona.priority_level === "high"
                              ? "text-rose-600 border-rose-200 bg-rose-50"
                              : persona.priority_level === "medium"
                              ? "text-yellow-600 border-yellow-200 bg-yellow-50"
                              : "text-green-600 border-green-200 bg-green-50"
                          }`}
                        >
                          {persona.priority_level.charAt(0).toUpperCase() +
                            persona.priority_level.slice(1)}
                        </Badge>
                      </div>
                    )}

                    {/* Role and Domain */}
                    {(persona.role || persona.domain) && (
                      <div className="flex flex-wrap gap-2">
                        {persona.role && (
                          <Badge variant="secondary" className="text-xs">
                            <User className="w-3 h-3 mr-1" />
                            {persona.role}
                          </Badge>
                        )}
                        {persona.domain && (
                          <Badge variant="secondary" className="text-xs">
                            <Building className="w-3 h-3 mr-1" />
                            {persona.domain}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Projects */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Projects:
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            (persona.project_count || 0) > 0
                              ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                              : "border workspace-border"
                          }`}
                        >
                          {persona.project_count || 0}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setManagingProjectsPersona(persona)}
                      >
                        <Settings2 className="w-3 h-3 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      {persona.auto_detected && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          Auto-detected
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs border workspace-border"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(persona.created_at!).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* AI-assisted wizard for creating personas. Edit goes through the
          same component via the editingPersona branch below. */}
      <AiCreateWizard
        workspaceId={workspaceId}
        open={isCreateModalOpen && !editingPersona}
        onOpenChange={(open) => !open && setIsCreateModalOpen(false)}
        onSaved={() => fetchPersonas()}
      />

      {/* Edit-mode wizard — same component as create, just pre-filled. */}
      {editingPersona && (
        <AiCreateWizard
          mode="edit"
          editId={editingPersona.id}
          initialDraft={{
            name: editingPersona.name ?? "",
            description: editingPersona.description ?? "",
            role: (editingPersona as any).role ?? "",
            domain: (editingPersona as any).domain ?? "",
            tech_savviness: (editingPersona as any).tech_savviness ?? 3,
            usage_frequency:
              ((editingPersona as any).usage_frequency as
                | "daily"
                | "weekly"
                | "monthly") ?? "weekly",
            priority_level:
              ((editingPersona as any).priority_level as
                | "high"
                | "medium"
                | "low") ?? "medium",
          }}
          workspaceId={workspaceId}
          open={!!editingPersona}
          onOpenChange={(open) => !open && setEditingPersona(null)}
          onSaved={() => {
            setEditingPersona(null);
            fetchPersonas();
          }}
        />
      )}

      {/* Manage Persona Projects Modal */}
      {managingProjectsPersona && (
        <ManagePersonaProjectsModal
          open={!!managingProjectsPersona}
          onOpenChange={(open) => {
            if (!open) setManagingProjectsPersona(null);
          }}
          persona={managingProjectsPersona}
          workspaceId={workspaceId}
          onUpdate={fetchPersonas}
        />
      )}
    </div>
  );
}
