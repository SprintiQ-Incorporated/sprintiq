import type React from "react";

export default function SetupWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="max-w-7xl mx-auto pt-8 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
