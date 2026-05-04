import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Flag, Goal, Users, User, AlertTriangle, TrendingUp, UserCheck, BarChart3, Download, ChevronDown, Filter, Zap, Lightbulb } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvatarInitials, exportToCSV } from "@/lib/analytics-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { priorityConfig } from "@/components/workspace/views/project/types";
import { cn, getColorByIndex } from "@/lib/utils";
import { TeamMember } from "@/types";

interface UserStory {
  id: string;
  title: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  assignedTeamMember?: TeamMember;
}

interface ValidationError {
  field: string;
  message: string;
}

type SortBy = 'title' | 'priority' | 'assignee' | 'date';
type FilterBy = 'all' | 'unassigned' | 'high-priority' | 'at-risk';

interface ActionableInsight {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
}

interface PriorityAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: UserStory[];
  onUpdateStory?: (storyId: string, updates: Partial<UserStory>) => void;
  teamMembers?: TeamMember[];
}

export default function PriorityAnalysisModal({
  isOpen,
  onClose,
  stories,
  onUpdateStory,
  teamMembers = [],
}: PriorityAnalysisModalProps) {
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // FIXED: Replaced useEffect + multiple setState calls with useMemo to prevent render loops
  // All derived data is now computed in a single memoized computation
  const { validationErrors, priorityData, assigneeData, metrics, insights } = useMemo(() => {
    // Phase 1: Data Validation
    const errors: ValidationError[] = [];
    stories.forEach((story, index) => {
      if (!story.title || story.title.trim() === '') {
        errors.push({
          field: `story_${index}_title`,
          message: `Story ${index + 1}: Missing title`,
        });
      }
      if (story.priority && !['Low', 'Medium', 'High', 'Critical'].includes(story.priority)) {
        errors.push({
          field: `story_${story.id}_priority`,
          message: `Story "${story.title}": Invalid priority "${story.priority}"`,
        });
      }
    });

    // Calculate priority distribution
    const priorityCounts = stories.reduce((acc, story) => {
      const priority = story.priority?.toLowerCase() || "none";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityChartData = Object.entries(priorityConfig).map(
      ([key, config]) => ({
        name: config.label,
        value: priorityCounts[key.toLowerCase()] || 0,
        color:
          getColorByIndex(
            config.color.replace("text-", "").replace("-600", "")
          ) || "#BDBDBD",
      })
    );

    // Add "No Priority" category
    priorityChartData.push({
      name: "No Priority",
      value: priorityCounts["none"] || 0,
      color: getColorByIndex("gray") || "#BDBDBD",
    });

    // Calculate assignee distribution
    const assigneeCounts = stories.reduce((acc, story) => {
      if (story.assignedTeamMember) {
        const memberId = story.assignedTeamMember.id;
        if (!acc[memberId]) {
          acc[memberId] = {
            count: 0,
            member: story.assignedTeamMember,
          };
        }
        acc[memberId].count += 1;
      } else {
        // Unassigned stories
        if (!acc["unassigned"]) {
          acc["unassigned"] = {
            count: 0,
            member: null,
          };
        }
        acc["unassigned"].count += 1;
      }
      return acc;
    }, {} as Record<string, { count: number; member: TeamMember | null }>);

    const assigneeChartData = Object.entries(assigneeCounts).map(
      ([memberId, data], index) => ({
        name: data.member ? data.member.name : "Unassigned",
        value: data.count,
        color:
          getColorByIndex(
            ["blue", "green", "purple", "orange", "pink", "cyan"][index % 6]
          ) || "#BDBDBD",
        memberId,
        memberName: data.member ? data.member.name : "Unassigned",
        memberRole: data.member ? data.member.role : "Unassigned",
      })
    );

    // Calculate metrics and risk indicators
    const assignedCount = stories.filter(s => s.assignedTeamMember).length;
    const unassignedCount = stories.length - assignedCount;
    const criticalCount = priorityCounts['critical'] || 0;
    const highCount = priorityCounts['high'] || 0;
    const assigneeCount = Object.keys(assigneeCounts).filter(k => k !== 'unassigned').length;

    const avgPerMember = assigneeCount > 0 ? stories.length / assigneeCount : 0;
    const pctUnassigned = stories.length > 0 ? (unassignedCount / stories.length) * 100 : 0;
    const pctHighPriority = stories.length > 0
      ? ((criticalCount + highCount) / stories.length) * 100
      : 0;

    const mostLoadedMember = assigneeChartData
      .filter(a => a.memberId !== 'unassigned')
      .reduce((max, curr) => curr.value > max.value ? curr : max, assigneeChartData[0]);

    // Detect risks
    const risks: Array<{ type: string; message: string; severity: 'warning' | 'error'; filter?: string }> = [];

    // Risk: Workload imbalance
    if (assigneeCount > 0 && mostLoadedMember && mostLoadedMember.value > avgPerMember * 2) {
      risks.push({
        type: 'workload',
        message: `Workload Imbalance: ${mostLoadedMember.memberName} has ${mostLoadedMember.value} stories (${(mostLoadedMember.value / avgPerMember).toFixed(1)}x average)`,
        severity: 'warning',
        filter: mostLoadedMember.memberId
      });
    }

    // Risk: High unassigned rate
    if (pctUnassigned > 30) {
      risks.push({
        type: 'unassigned',
        message: `High Unassigned Rate: ${pctUnassigned.toFixed(0)}% of stories have no assignee`,
        severity: pctUnassigned > 50 ? 'error' : 'warning',
        filter: 'unassigned'
      });
    }

    // Risk: Critical item concentration
    if (criticalCount > 0) {
      const criticalStories = stories.filter(s => s.priority?.toLowerCase() === 'critical');
      const criticalByMember = criticalStories.reduce((acc, s) => {
        const memberId = s.assignedTeamMember?.id || 'unassigned';
        acc[memberId] = (acc[memberId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const maxCritical = Math.max(...Object.values(criticalByMember));
      if (maxCritical > criticalCount * 0.5) {
        const overloadedMember = Object.entries(criticalByMember)
          .find(([_, count]) => count === maxCritical);
        if (overloadedMember) {
          const memberName = overloadedMember[0] === 'unassigned'
            ? 'Unassigned'
            : assigneeChartData.find(a => a.memberId === overloadedMember[0])?.memberName || 'Unknown';
          risks.push({
            type: 'critical-overload',
            message: `Critical Item Concentration: ${memberName} has ${maxCritical} of ${criticalCount} critical stories (${((maxCritical / criticalCount) * 100).toFixed(0)}%)`,
            severity: 'error',
            filter: overloadedMember[0]
          });
        }
      }
    }

    const computedMetrics = {
      totalStories: stories.length,
      avgPerMember: avgPerMember,
      pctUnassigned: pctUnassigned,
      pctHighPriority: pctHighPriority,
      mostLoaded: mostLoadedMember?.memberName || 'N/A',
      risks: risks
    };

    // Phase 3: Generate Actionable Insights
    const newInsights: ActionableInsight[] = [];

    if (pctUnassigned > 30) {
      newInsights.push({
        id: 'unassigned-action',
        title: 'Assign Unassigned Stories',
        description: `${unassignedCount} stories (${pctUnassigned.toFixed(0)}%) are not assigned to team members`,
        action: 'Review and assign unassigned stories to appropriate team members',
        priority: pctUnassigned > 50 ? 'high' : 'medium',
        icon: <UserCheck className="h-4 w-4" />,
      });
    }

    if (risks.length > 0) {
      newInsights.push({
        id: 'rebalance-action',
        title: 'Rebalance Workload',
        description: `Detected ${risks.length} workload imbalance issue(s) affecting team efficiency`,
        action: 'Consider reassigning tasks to balance team capacity',
        priority: 'high',
        icon: <TrendingUp className="h-4 w-4" />,
      });
    }

    if (pctHighPriority > 50) {
      newInsights.push({
        id: 'prioritize-action',
        title: 'High Priority Concentration',
        description: `${pctHighPriority.toFixed(0)}% of stories are high or critical priority`,
        action: 'Review priorities and consider deprioritizing non-urgent items',
        priority: 'high',
        icon: <Flag className="h-4 w-4" />,
      });
    }

    if (errors.length > 0) {
      newInsights.push({
        id: 'validation-action',
        title: 'Fix Data Issues',
        description: `Found ${errors.length} data validation error(s) that need attention`,
        action: 'Review and correct the validation errors above',
        priority: 'medium',
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }

    return {
      validationErrors: errors,
      priorityData: priorityChartData,
      assigneeData: assigneeChartData,
      metrics: computedMetrics,
      insights: newInsights
    };
  }, [stories]);

  // Phase 5: Advanced Filtering & Sorting
  const getFilteredStories = () => {
    let filtered = [...stories];

    // Apply basic filters
    if (filterBy === 'unassigned') {
      filtered = filtered.filter(s => !s.assignedTeamMember);
    } else if (filterBy === 'high-priority') {
      filtered = filtered.filter(s => ['High', 'Critical'].includes(s.priority || ''));
    } else if (filterBy === 'at-risk') {
      filtered = filtered.filter(s => !s.assignedTeamMember || !s.priority);
    }

    // Apply search term
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'priority': {
          const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3, undefined: 4 };
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
          return aPriority - bPriority;
        }
        case 'assignee':
          return (a.assignedTeamMember?.name || 'zzz').localeCompare(b.assignedTeamMember?.name || 'zzz');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredStories = getFilteredStories();
  const filteredStoriesByPriority = selectedPriority
    ? filteredStories.filter(
        (story) =>
          (story.priority?.toLowerCase() || "none") === selectedPriority
      )
    : filteredStories;

  const filteredStoriesByAssignee = selectedAssignee
    ? filteredStories.filter(
        (story) =>
          (story.assignedTeamMember?.id || "unassigned") === selectedAssignee
      )
    : filteredStories;

  const handlePriorityChange = (storyId: string, newPriority: string) => {
    if (onUpdateStory) {
      onUpdateStory(storyId, { priority: newPriority as UserStory['priority'] });
    }
  };

  const handleAssigneeChange = (storyId: string, memberId: string | null) => {
    if (onUpdateStory) {
      const member = memberId ? teamMembers.find(m => m.id === memberId) : undefined;
      onUpdateStory(storyId, { assignedTeamMember: member });
    }
  };

  const handleExportCSV = () => {
    exportToCSV(stories, 'priority-analysis');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto dark:bg-slate-950 dark:text-slate-50 transition-colors duration-200">
        <DialogHeader className="space-y-3">
          <DialogDescription className="sr-only">
            View AI-powered priority analysis with recommendations for task prioritization and workload distribution
          </DialogDescription>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <DialogTitle className="text-2xl">Story Analysis Dashboard</DialogTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Data Validation Errors - Phase 1 */}
          {validationErrors.length > 0 && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-red-900 dark:text-red-200">Data Validation Issues ({validationErrors.length})</p>
                      <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
                        {validationErrors.slice(0, 3).map((error, idx) => (
                          <li key={idx}>• {error.message}</li>
                        ))}
                        {validationErrors.length > 3 && (
                          <li>• {validationErrors.length - 3} more issue(s)</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogHeader>

        {/* Advanced Filters - Phase 5 */}
        {showFilters && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm dark:bg-slate-800 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter</label>
                <Select value={filterBy} onValueChange={(val) => setFilterBy(val as FilterBy)}>
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                    <SelectItem value="all">All Stories</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value="high-priority">High Priority</SelectItem>
                    <SelectItem value="at-risk">At Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortBy)}>
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="assignee">Assignee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Results</label>
                <div className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-800 font-medium">
                  {filteredStories.length} of {stories.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Metrics Panel */}
        {metrics && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Summary Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                  <div className="space-y-1 animate-in fade-in" style={{ animationDelay: '0ms' }}>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Total Stories</p>
                    <p className="text-2xl font-bold">{metrics.totalStories}</p>
                  </div>
                  <div className="space-y-1 animate-in fade-in" style={{ animationDelay: '50ms' }}>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Avg per Member</p>
                    <p className="text-2xl font-bold">{metrics.avgPerMember.toFixed(1)}</p>
                  </div>
                  <div className="space-y-1 animate-in fade-in" style={{ animationDelay: '100ms' }}>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Unassigned</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metrics.pctUnassigned.toFixed(0)}%</p>
                  </div>
                  <div className="space-y-1 animate-in fade-in" style={{ animationDelay: '150ms' }}>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">High Priority</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.pctHighPriority.toFixed(0)}%</p>
                  </div>
                </div>
                
                {/* Risk Indicators */}
                {metrics.risks.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-slate-400">
                      <AlertTriangle className="h-3 w-3" />
                      Risk Indicators
                    </div>
                    {metrics.risks.map((risk, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left h-auto py-2 px-3 animate-in fade-in transition-all hover:scale-105",
                          risk.severity === 'error' 
                            ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900" 
                            : "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-900"
                        )}
                        onClick={() => {
                          if (risk.filter) {
                            if (risk.type === 'unassigned' || risk.type === 'critical-overload') {
                              setSelectedAssignee(risk.filter);
                            } else if (risk.type === 'workload') {
                              setSelectedAssignee(risk.filter);
                            }
                          }
                        }}
                      >
                        <AlertTriangle className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="text-xs">{risk.message}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phase 3: Actionable Insights */}
            {insights.length > 0 && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-900 dark:text-blue-200">
                    <Lightbulb className="h-4 w-4" />
                    Actionable Insights ({insights.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className="animate-in fade-in slide-in-from-left-2 duration-300 p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">{insight.icon}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-blue-900 dark:text-blue-200">{insight.title}</p>
                            <Badge
                              className={cn(
                                'text-xs',
                                insight.priority === 'high'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              )}
                            >
                              {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-xs text-blue-700 dark:text-blue-300">{insight.description}</p>
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-100 flex items-center gap-1 mt-1">
                            <Zap className="h-3 w-3" />
                            {insight.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs defaultValue="priority" className="w-full">
          <TabsList className="grid w-full grid-cols-2 dark:bg-slate-900">
            <TabsTrigger value="priority" className="flex items-center gap-2 dark:data-[state=active]:bg-slate-800">
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Priority</span>
            </TabsTrigger>
            <TabsTrigger value="assignee" className="flex items-center gap-2 dark:data-[state=active]:bg-slate-800">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Assignee</span>
            </TabsTrigger>
          </TabsList>

          {/* Priority Analysis Tab */}
          <TabsContent value="priority" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Priority Distribution Chart */}
              <Card className="dark:bg-slate-900 dark:border-slate-800 animate-in fade-in slide-in-from-left-2 duration-300">
                <CardContent className="pt-6">
                  <div className="h-[300px] sm:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          className="text-xs sm:text-sm"
                          label={({ name, value }) =>
                            `${name}: ${value}`
                          }
                        >
                          {priorityData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() =>
                                setSelectedPriority(
                                  entry.name === "No Priority"
                                    ? "none"
                                    : entry.name.toLowerCase()
                                )
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `${value} stories`}
                          wrapperClassName="text-xs sm:text-sm p-1 dark:bg-slate-800 dark:text-slate-50 rounded"
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: 'none', borderRadius: '6px', color: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Priority Filter and Story List */}
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedPriority === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPriority(null)}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    All
                  </Button>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPriority(key)}
                      className={cn(
                        "dark:border-slate-700 dark:hover:bg-slate-800 transition-colors",
                        config.color,
                        selectedPriority === key
                          ? "border workspace-component-active-border dark:bg-slate-800"
                          : ""
                      )}
                    >
                      {selectedPriority === key ? (
                        <Check className="h-4 w-4 mr-1 sm:mr-2" />
                      ) : (
                        <Goal className="h-4 w-4 mr-1 sm:mr-2" />
                      )}
                      <span className="hidden sm:inline">{config.label}</span>
                    </Button>
                  ))}
                  <Button
                    variant={
                      selectedPriority === "none" ? "default" : "outline"
                    }
                    size="sm"
                    className="dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setSelectedPriority("none")}
                  >
                    None
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 md:pr-0">
                  {filteredStoriesByPriority.length > 0 ? (
                    filteredStoriesByPriority.map((story, idx) => (
                      <Card
                        key={story.id}
                        className="p-3 dark:bg-slate-900 dark:border-slate-800 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-slate-900 transition-all animate-in fade-in duration-200"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-sm flex-1 line-clamp-2">{story.title}</span>
                          {onUpdateStory ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-700 transition-colors w-full sm:w-auto"
                                >
                                  {story.priority || 'Set'}
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                                {Object.entries(priorityConfig).map(([key, config]) => (
                                  <DropdownMenuItem
                                    key={key}
                                    onClick={() => handlePriorityChange(story.id, key)}
                                    className="dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                  >
                                    {config.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  onClick={() => handlePriorityChange(story.id, '')}
                                  className="dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                >
                                  Clear
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            story.priority && (
                              <Badge
                                className={cn(
                                  "hover:workspace-hover transition-colors",
                                  priorityConfig[
                                    story.priority.toLowerCase() as keyof typeof priorityConfig
                                  ]?.bgColor
                                )}
                              >
                                {story.priority}
                              </Badge>
                            )
                          )}
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <Flag className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-muted-foreground dark:text-slate-400">No stories found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Assignee Analysis Tab */}
          <TabsContent value="assignee" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Assignee Distribution Chart */}
              <Card className="dark:bg-slate-900 dark:border-slate-800 animate-in fade-in slide-in-from-left-2 duration-300">
                <CardContent className="pt-6">
                  <div className="h-[300px] sm:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assigneeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          className="text-xs sm:text-sm"
                          label={({ name, value }) =>
                            `${name}: ${value}`
                          }
                        >
                          {assigneeData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() =>
                                setSelectedAssignee(entry.memberId)
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `${value} stories`}
                          wrapperClassName="text-xs sm:text-sm p-1 dark:bg-slate-800 dark:text-slate-50 rounded"
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: 'none', borderRadius: '6px', color: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Assignee Filter and Story List */}
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedAssignee === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedAssignee(null)}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    All
                  </Button>
                  {assigneeData.map((assignee) => (
                    <Button
                      key={assignee.memberId}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAssignee(assignee.memberId)}
                      className={cn(
                        "dark:border-slate-700 dark:hover:bg-slate-800 transition-colors",
                        selectedAssignee === assignee.memberId
                          ? "border workspace-component-active-border dark:bg-slate-800"
                          : ""
                      )}
                    >
                      {selectedAssignee === assignee.memberId ? (
                        <Check className="h-4 w-4 mr-1 sm:mr-2" />
                      ) : (
                        <User className="h-4 w-4 mr-1 sm:mr-2" />
                      )}
                      <span className="hidden sm:inline truncate">{assignee.memberName}</span>
                    </Button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 md:pr-0">
                  {filteredStoriesByAssignee.length > 0 ? (
                    filteredStoriesByAssignee.map((story, idx) => (
                      <Card
                        key={story.id}
                        className="p-3 dark:bg-slate-900 dark:border-slate-800 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-slate-900 transition-all animate-in fade-in duration-200"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-sm flex-1 line-clamp-2">{story.title}</span>
                          <div className="flex items-center gap-2">
                            {onUpdateStory ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-700 transition-colors w-full sm:w-auto"
                                  >
                                    {story.assignedTeamMember ? (
                                      <>
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={story.assignedTeamMember.avatar_url || undefined} />
                                          <AvatarFallback className="text-xs bg-slate-300 dark:bg-slate-600">
                                            {getAvatarInitials(story.assignedTeamMember.name, story.assignedTeamMember.email)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs hidden sm:inline">{story.assignedTeamMember.name}</span>
                                      </>
                                    ) : (
                                      'Assign'
                                    )}
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-[200px] overflow-y-auto dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50">
                                  {teamMembers.map((member) => (
                                    <DropdownMenuItem
                                      key={member.id}
                                      onClick={() => handleAssigneeChange(story.id, member.id)}
                                      className="dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                    >
                                      <Avatar className="h-4 w-4 mr-2">
                                        <AvatarImage src={member.avatar_url || undefined} />
                                        <AvatarFallback className="text-xs bg-slate-300 dark:bg-slate-600">
                                          {getAvatarInitials(member.name, member.email)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {member.name}
                                    </DropdownMenuItem>
                                  ))}
                                  {teamMembers.length > 0 && (
                                    <DropdownMenuItem
                                      onClick={() => handleAssigneeChange(story.id, null)}
                                      className="dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                    >
                                      Unassign
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              story.assignedTeamMember ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={
                                        story.assignedTeamMember.avatar_url ||
                                        undefined
                                      }
                                    />
                                    <AvatarFallback className="text-xs bg-slate-300 dark:bg-slate-600">
                                      {getAvatarInitials(
                                        story.assignedTeamMember.name,
                                        story.assignedTeamMember.email
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-gray-600 dark:text-slate-300 hidden sm:inline">
                                    {story.assignedTeamMember.name}
                                  </span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                                  Unassigned
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-muted-foreground dark:text-slate-400">No stories found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
