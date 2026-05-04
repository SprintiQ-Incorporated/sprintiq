"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MCPAuthSuccess() {
  const searchParams = useSearchParams();
  const [connectionId, setConnectionId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [type, setType] = useState<string>("legacy");
  const [warning, setWarning] = useState<string>("");

  useEffect(() => {
    const connId = searchParams.get("connectionId");
    const userEmail = searchParams.get("email");
    const authToken = searchParams.get("token");
    const flowType = searchParams.get("type") || "legacy";
    const warningType = searchParams.get("warning");

    if (connId) setConnectionId(connId);
    if (userEmail) setEmail(userEmail);
    if (authToken) setToken(authToken);
    setType(flowType);
    if (warningType) setWarning(warningType);
  }, [searchParams]);

  const isCursorFlow = type === "cursor";
  const isAccountNotActivated = warning === "account_not_activated";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div
            className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${
              isAccountNotActivated ? "bg-yellow-100" : "bg-green-100"
            }`}
          >
            {isAccountNotActivated ? (
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            {isAccountNotActivated
              ? "Authentication Complete (Account Pending)"
              : isCursorFlow
              ? "Authentication Complete!"
              : "MCP Authorization Successful!"}
          </h2>

          <p className="mt-2 text-gray-600">
            {isAccountNotActivated
              ? "You have successfully signed in, but your account is not yet activated."
              : isCursorFlow
              ? "You have successfully signed in to SprintIQ. You can now return to Cursor."
              : "You are now authorized to use SprintIQ MCP features."}
          </p>

          {email && (
            <p className="mt-4 text-sm text-gray-500">
              Authorized email: <strong>{email}</strong>
            </p>
          )}

          {connectionId && (
            <p className="mt-1 text-sm text-gray-500">
              Connection ID:{" "}
              <code className="bg-gray-100 px-1 rounded">{connectionId}</code>
            </p>
          )}

          {isAccountNotActivated && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-900">
                Account Not Activated
              </h3>
              <div className="text-sm text-yellow-700 mt-1 space-y-2">
                <p>Your account has been created but is not yet activated.</p>
                <p>
                  Please contact your administrator to activate your account.
                </p>
                <p>
                  Once activated, you&apos;ll be able to use all SprintIQ MCP
                  features.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {isCursorFlow && !isAccountNotActivated ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900">
                  Next Steps for Cursor
                </h3>
                <div className="text-sm text-blue-700 mt-1 space-y-2">
                  <p>1. Return to Cursor</p>
                  <p>2. Start a new conversation thread and type &quot;Done&quot;</p>
                  <p>3. Your SprintIQ connection will be established!</p>
                </div>
              </div>
            ) : isCursorFlow && isAccountNotActivated ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-900">
                  Next Steps for Cursor
                </h3>
                <div className="text-sm text-yellow-700 mt-1 space-y-2">
                  <p>1. Contact your administrator to activate your account</p>
                  <p>2. Once activated, return to Cursor</p>
                  <p>3. Start a new conversation thread and type &quot;Done&quot;</p>
                </div>
              </div>
            ) : !isAccountNotActivated ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900">
                  What&apos;s Next?
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  You can now use MCP clients like Claude Desktop to interact
                  with your SprintIQ workspace.
                </p>
              </div>
            ) : null}

            {!isAccountNotActivated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900">
                  Available Features
                </h3>
                <ul className="text-sm text-green-700 mt-1 space-y-1">
                  <li>• Generate user stories</li>
                  <li>• Analyze task priorities</li>
                  <li>• Manage team assignments</li>
                  <li>• Access workspace data</li>
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={() => window.close()}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
            >
              Close Window
            </button>

            {!isCursorFlow && (
              <Link
                href="/dashboard"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-center"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

