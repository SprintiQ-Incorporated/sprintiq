"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/workspace/components";
import {
  PortfolioStats,
  ActivityFeed,
  PortfolioItemCard,
} from "@/components/workspace/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";

interface PortfolioItem {
  id: string;
  spaceId: string; // Short space_id for navigation
  name: string;
  description?: string;
  type?: string;
  icon?: string;
  color?: string;
  projects?: number;
  members?: number;
  sprints?: number;
  progress?: number;
  status?: "active" | "planning" | "on-hold" | "completed";
  dueDate?: string;
  memberAvatars?: Array<{ id: string; name: string; avatar?: string }>;
  risk?: "low" | "medium" | "high";
}

interface PortfolioDashboardProps {
  workspaceId: string;
  portfolioItems?: PortfolioItem[];
  stats?: Array<{
    label: string;
    value: number;
    total?: number;
    change?: number;
    trend?: "up" | "down" | "neutral";
    unit?: string;
  }>;
  activities?: Array<{
    id: string;
    type: "created" | "updated" | "deleted" | "completed" | "assigned";
    entityType: "project" | "sprint" | "task" | "team" | "member";
    entityName: string;
    user: { name: string; avatar?: string };
    timestamp: string;
    description?: string;
  }>;
  onCreatePortfolio?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function PortfolioDashboard({
  workspaceId,
  portfolioItems = [],
  stats,
  activities,
  onCreatePortfolio,
  onRefresh,
  className,
}: PortfolioDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState(portfolioItems);

  useEffect(() => {
    if (searchQuery) {
      const filtered = portfolioItems.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(portfolioItems);
    }
  }, [searchQuery, portfolioItems]);

  return (
    <div className={`h-full overflow-y-auto p-6 bg-gray-50 ${className}`}>
      {/* Page Header */}
      <div id="portfolio-header">
        <PageHeader
          title="Portfolio"
          subtitle="Manage your project portfolio and track progress"
          action={
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="outline" onClick={onRefresh} size="sm">
                  Refresh
                </Button>
              )}
              {onCreatePortfolio && (
                <Button
                  id="portfolio-new-button"
                  onClick={onCreatePortfolio}
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Portfolio
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Overview Section */}
      <div id="portfolio-overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Stats */}
        <div id="portfolio-stats">
          <PortfolioStats stats={stats} />
        </div>

        {/* Activity Feed */}
        <div id="portfolio-activity" className="lg:col-span-2">
          <ActivityFeed activities={activities} maxItems={5} />
        </div>
      </div>

      {/* Portfolio Items Section */}
      <div id="portfolio-items-section" className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Portfolio Items
          </h2>
          <div className="flex gap-2">
            <div id="portfolio-search" className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search portfolio items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button id="portfolio-filter" variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Portfolio Grid */}
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💼</div>
            <div className="empty-state-title">
              {searchQuery ? "No portfolio items found" : "No portfolio items yet"}
            </div>
            <div className="empty-state-description">
              {searchQuery
                ? "Try adjusting your search query"
                : "Create your first portfolio item to organize your projects"}
            </div>
            {!searchQuery && onCreatePortfolio && (
              <div className="mt-4">
                <Button
                  onClick={onCreatePortfolio}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Portfolio Item
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div id="portfolio-items-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <PortfolioItemCard
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                type={item.type}
                icon={item.icon}
                color={item.color}
                projects={item.projects || 0}
                members={item.members || 0}
                sprints={item.sprints || 0}
                progress={item.progress}
                status={item.status}
                dueDate={item.dueDate}
                memberAvatars={item.memberAvatars}
                risk={item.risk}
                href={`/${workspaceId}/space/${item.spaceId}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
