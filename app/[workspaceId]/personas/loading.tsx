import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personas - SprintiQ",
  description: "SprintiQ Personas page",
};

export default function PersonaLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold">Personas</h1>
          <div className="h-3 w-8 bg-gray-300 rounded"></div>
        </div>
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="h-8 w-80 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="h-5 w-16 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
