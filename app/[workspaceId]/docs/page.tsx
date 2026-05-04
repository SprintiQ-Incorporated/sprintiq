import { Github } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Find guides, support resources, and reference material for SprintiQ.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="https://github.com/SprintiQ-Incorporated/sprintiq/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="group flex flex-col rounded-xl border border-blue-500/20 bg-card p-5 transition-all duration-200 hover:border-emerald-500/40 hover:bg-emerald-500/5 h-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 mb-4">
              <Github className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold mb-1">GitHub Issues</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Report bugs, request features, or ask questions on GitHub.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
}
