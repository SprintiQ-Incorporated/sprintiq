/**
 * Access Denied Component
 * Shown when users don't have permission to access internal tools
 */

import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AccessDeniedProps {
  workspaceId: string;
  requiredRoles?: string[];
  message?: string;
}

export function AccessDenied({
  workspaceId,
  requiredRoles = ["admin", "developer"],
  message,
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-red-50 rounded-full">
              <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Restricted
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            {message ||
              "This page is restricted to internal development team members only."}
          </p>

          {/* Required Roles */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Required Role:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {requiredRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700"
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              ))}
            </div>
          </div>

          {/* Help Text */}
          <p className="text-sm text-gray-500 mb-6">
            If you believe you should have access to this page, please contact
            your workspace administrator.
          </p>

          {/* Back Button */}
          <Link
            href={`/${workspaceId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This is an internal development tool for the SprintIQ team.
          </p>
        </div>
      </div>
    </div>
  );
}
