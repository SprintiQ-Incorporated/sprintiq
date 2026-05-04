"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import type { Workspace } from "@/lib/database-aliases";
import {
  Loader2,
  CheckCircle2,
  Building2,
  Users,
  Briefcase,
  Home,
  ArrowRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SwitchWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWorkspaceId: string;
}

// Helper function to get workspace icon based on purpose
const getWorkspaceIcon = (purpose: string) => {
  switch (purpose?.toLowerCase()) {
    case "team":
      return <Users className="h-5 w-5" />;
    case "business":
      return <Building2 className="h-5 w-5" />;
    case "personal":
      return <Home className="h-5 w-5" />;
    default:
      return <Briefcase className="h-5 w-5" />;
  }
};

export default function SwitchWorkspaceModal({
  open,
  onOpenChange,
  currentWorkspaceId,
}: SwitchWorkspaceModalProps) {
  const { user } = useAuth();
  const supabase = createClientSupabaseClient();
  const router = useRouter();

  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [switchingWorkspace, setSwitchingWorkspace] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!user) {
        setError("User not authenticated.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<Workspace[]>();

      if (error) {
        setError("Failed to load workspaces.");
      } else if (data) {
        setWorkspaces(data);
      }
      setIsLoading(false);
    };

    if (open) {
      fetchWorkspaces();
    }
  }, [open, user, supabase]);

  const handleSwitch = (workspaceShortId: string) => {
    if (workspaceShortId === currentWorkspaceId) {
      onOpenChange(false); // Close modal if already on this workspace
      return;
    }
    setSwitchingWorkspace(workspaceShortId);
    router.push(`/${workspaceShortId}/home`);
    onOpenChange(false); // Close modal after initiating switch
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-gradient-to-br from-white via-gray-50/50 to-white border-0 shadow-2xl">
        {/* Header with glassmorphism effect */}
        <DialogTitle className="sr-only">Switch Workspace</DialogTitle>
        <DialogDescription className="sr-only">
          Select a workspace to switch to and manage your workspace selection
        </DialogDescription>
        {/* Header */}
        <div className="workspace-primary px-8 py-6 flex items-center gap-4">
          <Building2 className="h-10 w-10 text-white drop-shadow-lg" />
          <div>
            <div className="text-lg font-semibold text-white flex items-center gap-2">
              Switch Workspace
            </div>
            <div className="text-white/90 text-sm">
              Choose your destination workspace
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse"></div>
              </div>
              <span className="mt-6 text-gray-600 font-semibold text-lg">
                Loading your workspaces...
              </span>
              <span className="text-sm text-gray-500 mt-2">
                Please wait a moment
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-red-600 text-2xl font-bold">!</span>
              </div>
              <p className="text-red-600 font-semibold text-lg">{error}</p>
              <p className="text-sm text-gray-500 mt-2">
                Please try again later
              </p>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-semibold text-lg">
                No other workspaces found
              </p>
              <p className="text-sm text-gray-500 mt-2">
                You only have access to this workspace
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-4">
                {workspaces.map((ws, index) => {
                  const isCurrent = ws.workspace_id === currentWorkspaceId;
                  const isSwitching = switchingWorkspace === ws.workspace_id;

                  return (
                    <div
                      key={ws.id}
                      className={cn(
                        "group relative rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer overflow-hidden",
                        isCurrent
                          ? "border-workspace-primary workspace-component-bg shadow-lg"
                          : `border-gray-200/50 bg-white/80 backdrop-blur-sm hover:border-gray-300/50 from-gray-500/20 to-slate-500/20 border-gray-200/50`,
                        isSwitching && "opacity-75 scale-95"
                      )}
                      onClick={() => handleSwitch(ws.workspace_id)}
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animation: "fadeInUp 0.5s ease-out forwards",
                      }}
                    >
                      {/* Background gradient overlay */}
                      <div
                        className={cn(
                          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                          isCurrent
                            ? "workspace-component-bg"
                            : "from-gray-500/20 to-slate-500/20 border-gray-200/50"
                        )}
                      />

                      <div className="relative p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Icon with gradient background */}
                            <div
                              className={cn(
                                "p-3 rounded-xl border-2 transition-all duration-300 group-hover:scale-110",
                                isCurrent
                                  ? "workspace-primary-bg border-workspace-primary shadow-lg"
                                  : "text-gray-600 bg-gray-100/50 border-gray-200"
                              )}
                            >
                              <div className={isCurrent ? "text-white" : ""}>
                                {getWorkspaceIcon(ws.purpose || "")}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-bold text-gray-900 text-lg truncate">
                                  {ws.name}
                                </h3>
                                {isCurrent && (
                                  <Badge className="workspace-primary-bg text-white border-workspace-primary font-semibold px-3 py-1">
                                    Active
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs capitalize font-medium px-3 py-1",
                                    isCurrent
                                      ? "border-workspace-primary text-workspace-primary workspace-component-bg"
                                      : "border-gray-300 text-gray-600 bg-gray-50"
                                  )}
                                >
                                  {ws.purpose || "workspace"}
                                </Badge>

                                {ws.category && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                    {ws.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 ml-6">
                            {isCurrent && (
                              <div className="p-2 rounded-full workspace-primary-bg border-2 border-workspace-primary">
                                <CheckCircle2 className="h-5 w-5 text-white" />
                              </div>
                            )}
                            {isSwitching && (
                              <div className="p-2 rounded-full bg-blue-100 border-2 border-blue-200">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                              </div>
                            )}
                            {!isCurrent && !isSwitching && (
                              <div className="p-2 rounded-full bg-gray-100 border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ArrowRight className="h-5 w-5 text-gray-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <style jsx>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
