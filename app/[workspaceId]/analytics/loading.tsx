import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "@/components/ui/gauge";
import { DashboardWidgetSkeleton } from "@/components/ui/skeleton-loaders";
import {
  BarChart3,
  CirclePlay,
  Clock,
  Hash,
  Layout,
  LayoutDashboard,
  SquareCheckBig,
  Timer,
  Users,
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home - SprintiQ",
  description: "SprintiQ Home page",
};

export default function HomeLoading() {
  return (
    <div>
      {/* Welcome Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 px-3 mt-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 col-span-3">
          <Card className="workspace-header-bg border workspace-border col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">
                <div className="w-64 h-6 animated-pulse bg-gray-200 rounded-md" />
              </CardTitle>
              <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                <LayoutDashboard className="h-6 w-6 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <div className="w-96 h-3 animated-pulse bg-gray-200 rounded-md" />
            </CardContent>
          </Card>
          {/* Creation Trends Chart */}
          <div className="col-span-3">
            <Card className="workspace-header-bg border workspace-border col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Daily Creation Trends
                </CardTitle>
                <div className="w-32 h-6 animated-pulse bg-gray-200 rounded-md" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full grid grid-cols-5 gap-3">
                  <div className="col-span-3 rotate-180">
                    <div className="grid grid-cols-12 gap-2">
                      {[12, 6, 18, 16, 2, 14, 8, 10, 14, 20, 8, 24].map(
                        (value, index) => (
                          <div
                            key={index}
                            className="animated-pulse bg-gray-200 rounded-md flex items-center justify-center"
                            style={{ height: `${value * 10}px` }}
                          />
                        )
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-col justify-between">
                    <div>
                      {/* Overall Balance */}
                      <div className="mb-4 space-y-2">
                        <div className="text-2xl font-bold">
                          <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                        </div>
                        <div className="text-xs text-gray-500">
                          <div className="w-24 h-4 animated-pulse bg-gray-200 rounded-md" />
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-500/10 rounded-md flex items-center justify-center p-2">
                              <SquareCheckBig className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">0</div>
                              <div className="text-xs text-gray-500">
                                Total Stories
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-500/10 rounded-md flex items-center justify-center p-2">
                              <Hash className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">0</div>
                              <div className="text-xs text-gray-500">
                                Total Projects
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-500/10 rounded-md flex items-center justify-center p-2">
                              <CirclePlay className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">0</div>
                              <div className="text-xs text-gray-500">
                                Total Sprints
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-500/10 rounded-md flex items-center justify-center p-2">
                              <Layout className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">0</div>
                              <div className="text-xs text-gray-500">
                                Total Spaces
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="col-span-3">
            <Card className="shadow-sm workspace-header-bg border workspace-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg font-bold">By Space</CardTitle>
                  <p className="text-xs text-muted-foreground">Distribution</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 animated-pulse bg-gray-200 rounded-md" />
                  <div className="w-12 h-6 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-lg font-bold mb-1">
                    <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                  </div>
                </div>

                <div className="relative w-32 h-32">
                  {/* Center text - changes based on hover */}
                  <div className="w-32 h-32 border-[10px] border-gray-200 rounded-full animated-pulse workspace-header-bg" />
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ zIndex: 1 }}
                  >
                    <div className="text-xl font-bold">
                      <div className="w-8 h-6 animated-pulse bg-gray-200 rounded-md mb-2" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div className="w-8 h-3 animated-pulse bg-gray-200 rounded-md" />
                    </div>
                  </div>
                </div>
              </CardContent>

              {/* Space breakdown list */}
              <div className="px-6 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((space, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-gray-50/50 rounded-lg workspace-secondary-sidebar-bg"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#808080" }}
                      />
                      <span className="text-sm font-medium">
                        <div className="w-16 h-4 animated-pulse bg-gray-200 rounded-md" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
        <div className="flex flex-col gap-3 col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="workspace-header-bg border workspace-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Session Time
                </CardTitle>
                <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                  <Timer className="h-5 w-5 text-gray-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-header-bg border workspace-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Stories per Session
                </CardTitle>
                <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                  <BarChart3 className="h-5 w-5 text-gray-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-header-bg border workspace-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Tasks
                </CardTitle>
                <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-header-bg border workspace-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Team Members
                </CardTitle>
                <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                  <Users className="h-5 w-5 text-gray-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="shadow-sm workspace-header-bg border workspace-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg font-bold">Task Status</CardTitle>
                <p className="text-xs text-muted-foreground">Distribution</p>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-lg font-bold mb-1">
                  <div className="w-16 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <div className="w-24 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </div>

              <div className="relative w-32 h-32">
                {/* Center text - changes based on hover */}
                <div className="w-32 h-32 border-[10px] border-gray-200 rounded-full animated-pulse workspace-header-bg" />
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ zIndex: 1 }}
                >
                  <div className="text-xl font-bold">
                    <div className="w-8 h-6 animated-pulse bg-gray-200 rounded-md mb-2" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="w-8 h-3 animated-pulse bg-gray-200 rounded-md" />
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Status breakdown list */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[...Array(4)].map((status, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50/50 rounded-lg workspace-secondary-sidebar-bg"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#808080" }}
                    />
                    <span className="text-sm font-medium">
                      <div className="w-16 h-4 animated-pulse bg-gray-200 rounded-md" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="workspace-header-bg border workspace-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Task Progress
              </CardTitle>
              <div className="flex items-center bg-gray-500/10 rounded-md p-2">
                <BarChart3 className="h-5 w-5 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between relative">
              <div className="flex flex-col items-start gap-1 py-4">
                <div className="text-2xl text-center font-bold">
                  <div className="w-24 h-8 animated-pulse bg-gray-200 rounded-md" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <div className="w-32 h-3 animated-pulse bg-gray-200 rounded-md" />
                </div>
              </div>
              <div className="absolute right-12 pt-12">
                <Gauge
                  value={0}
                  label="Task Progress"
                  size="lg"
                  color="#1E90FF"
                  backgroundColor="#F0F0F0"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
