"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Send,
  X,
  Bot,
  Plus,
  Search,
  Sparkles,
  Zap,
  User,
} from "lucide-react";
import {
  createTaskWithAI,
  findSimilarTasksWithAI,
  validateProjectId,
} from "@/app/[workspaceId]/actions";
import { useParams } from "next/navigation";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import ReactMarkdown from "react-markdown";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database-aliases";
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  isLoading?: boolean;
  timestamp?: Date;
};

type ConversationState =
  | { state: "idle" }
  | {
      state: "create_task";
      step: "ask_project" | "ask_task_name" | "ask_description" | "confirm";
      projectId?: string;
      taskName?: string;
      description?: string;
    }
  | {
      state: "find_similar";
      step: "ask_query" | "show_results";
      query?: string;
    };

export default function AIAssistantSidebar({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help you **create tasks** or **find similar tasks**. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>(
    { state: "idle" }
  );
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { toast } = useEnhancedToast();

  // Fetch user profile from profiles table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;

      try {
        const supabase = createClientSupabaseClient();
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .eq("id", user.id)
          .maybeSingle();

        if (!error && profileData) {
          setUserProfile(profileData as Profile);
        }
      } catch { }
    };

    fetchUserProfile();
  }, [user?.id]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add a message from the assistant
  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content, timestamp: new Date() },
    ]);
  };

  // Add a message from the user
  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content, timestamp: new Date() },
    ]);
  };

  // Add a loading message that will be replaced
  const addLoadingMessage = () => {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        isLoading: true,
        timestamp: new Date(),
      },
    ]);
  };

  // Replace the last message
  const replaceLastMessage = (content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[newMessages.length - 1] = {
        role: "assistant",
        content,
        timestamp: new Date(),
      };
      return newMessages;
    });
  };


  // Handle create task button click
  const handleCreateTask = () => {
    addUserMessage("I want to create a new task");
    addAssistantMessage(
      "Perfect! Let's create a new task. Please provide the project ID where you'd like to create it."
    );
    setConversationState({ state: "create_task", step: "ask_project" });
  };

  // Handle find similar tasks button click
  const handleFindSimilarTasks = () => {
    addUserMessage("I want to find similar tasks");
    addAssistantMessage(
      "Great! I'll help you find similar tasks. Please enter a description or keywords to search for."
    );
    setConversationState({ state: "find_similar", step: "ask_query" });
  };

  // Process user input based on conversation state
  const processUserInput = async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    addUserMessage(userInput);
    setInput("");
    setIsProcessing(true);
    addLoadingMessage();

    try {
      if (conversationState.state === "idle") {
        // Process general queries in idle state
        if (
          userInput.toLowerCase().includes("create task") ||
          userInput.toLowerCase().includes("new task")
        ) {
          replaceLastMessage(
            "Perfect! Let's create a new task. Please provide the project ID where you'd like to create it."
          );
          setConversationState({ state: "create_task", step: "ask_project" });
        } else if (
          userInput.toLowerCase().includes("find") ||
          userInput.toLowerCase().includes("similar")
        ) {
          replaceLastMessage(
            "Great! I'll help you find similar tasks. Please enter a description or keywords to search for."
          );
          setConversationState({ state: "find_similar", step: "ask_query" });
        } else {
          replaceLastMessage(
            "I can help you **create tasks** or **find similar tasks**. Try clicking one of the action buttons or type \"create task\" or \"find similar\"."
          );
        }
      } else if (conversationState.state === "create_task") {
        if (conversationState.step === "ask_project") {
          // Validate project ID
          const { exists, projectName, error } =
            await validateProjectId(userInput, workspaceId);

          if (error || !exists) {
            replaceLastMessage(
              `I couldn't find a project with that ID. Please check the project ID and try again.`
            );
          } else {
            replaceLastMessage(
              `Excellent! You're creating a task in project **"${projectName}"**. What should we call this task?`
            );
            setConversationState({
              state: "create_task",
              step: "ask_task_name",
              projectId: userInput,
            });
          }
        } else if (conversationState.step === "ask_task_name") {
          replaceLastMessage(
            `Perfect! Task name: **"${userInput}"**. Would you like to add a description? (Type a description or "skip" to continue without one)`
          );
          setConversationState({
            ...conversationState,
            step: "ask_description",
            taskName: userInput,
          });
        } else if (conversationState.step === "ask_description") {
          const description =
            userInput.toLowerCase() === "skip" ? "" : userInput;

          replaceLastMessage(
            `Great! Here's what I'm about to create:\n\n**Task Name:** ${
              conversationState.taskName
            }\n**Description:** ${
              description || "No description"
            }\n\nDoes this look correct? (yes/no)`
          );
          setConversationState({
            ...conversationState,
            step: "confirm",
            description,
          });
        } else if (conversationState.step === "confirm") {
          if (
            userInput.toLowerCase() === "yes" ||
            userInput.toLowerCase() === "y"
          ) {
            replaceLastMessage("Creating your task...");

            // Create the task
            const result = await createTaskWithAI(
              conversationState.projectId!,
              conversationState.taskName!,
              conversationState.description || "",
              workspaceId
            );

            if (result.error) {
              addAssistantMessage(`❌ Error creating task: ${result.error}`);
            } else {
              const taskUrl = `/${workspaceId}/space/${result.spaceId}/project/${result.projectId}/task/${result.taskId}`;
              addAssistantMessage(
                `✅ **Task created successfully!**\n\n**Task:** ${result.taskName}\n**View:** [Open Task](${taskUrl})`
              );

              toast({
                title: "Task created successfully",
                description: "Your new task has been added to the project",
                browserNotificationTitle: "Task created successfully",
                browserNotificationBody:
                  "Your new task has been added to the project",
              });
            }

            // Reset conversation state
            setConversationState({ state: "idle" });
          } else {
            replaceLastMessage(
              "No problem! Task creation cancelled. What would you like to do next?"
            );
            setConversationState({ state: "idle" });
          }
        }
      } else if (conversationState.state === "find_similar") {
        if (conversationState.step === "ask_query") {
          replaceLastMessage("Searching for similar tasks...");

          // Find similar tasks
          const result = await findSimilarTasksWithAI(userInput, workspaceId);

          if (result.error) {
            addAssistantMessage(
              `❌ Error finding similar tasks: ${result.error}`
            );
          } else if (!result.tasks || result.tasks.length === 0) {
            addAssistantMessage(
              "I couldn't find any similar tasks with those keywords. Would you like to try a different search term?"
            );
          } else {
            let response = `🔍 **Found ${result.tasks.length} similar task${
              result.tasks.length > 1 ? "s" : ""
            }:**\n\n`;

            result.tasks.forEach((task, index) => {
              const taskUrl = `/${workspaceId}/space/${task.space_id}/project/${task.project_id}/task/${task.task_id}`;
              response += `${index + 1}. **${task.name}**\n`;
              if (task.description) {
                // Clean up description by removing HTML tags and limiting length
                const cleanDescription = task.description
                  .replace(/<[^>]*>/g, "") // Remove HTML tags
                  .replace(/\n+/g, " ") // Replace multiple newlines with single space
                  .trim();
                if (cleanDescription) {
                  response += `   ${cleanDescription.substring(0, 100)}${
                    cleanDescription.length > 100 ? "..." : ""
                  }\n`;
                }
              }
              response += `   [View Task](${taskUrl})\n\n`;
            });

            addAssistantMessage(response);
          }

          // Reset conversation state
          setConversationState({ state: "idle" });
        }
      }
    } catch {
      replaceLastMessage("Sorry, I encountered an error. Please try again.");
      setConversationState({ state: "idle" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processUserInput();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-[420px] workspace-surface shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l workspace-border ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b workspace-border bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            </div>
            <div>
              <h2 className="font-semibold text-lg workspace-text">
                AI Assistant
              </h2>
              <p className="text-sm workspace-text-muted">Ready to help</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="p-6 border-b workspace-border bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="h-4 w-4 text-emerald-600" />
            <h3 className="font-medium text-sm workspace-text">
              Quick Actions
            </h3>
          </div>

          <div className="flex gap-3">
            <Card className="group/card flex-1 min-w-0 border-0 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer bg-gradient-to-r from-green-50 to-green-100 dark:from-emerald-950/30 dark:to-emerald-900/30 hover:flex-[4] overflow-hidden">
              <CardContent className="p-0">
                <Button
                  variant="ghost"
                  className="group w-full h-auto p-2 justify-start hover:bg-transparent transition-all duration-300 ease-in-out overflow-hidden"
                  onClick={handleCreateTask}
                  disabled={isProcessing}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                  <span className="opacity-100 group-hover:opacity-100 transition-opacity duration-300 ease-in-out whitespace-nowrap flex items-center overflow-hidden">
                    Create Task ➤
                  </span>
                </Button>
              </CardContent>
            </Card>

            <Card className="group/card flex-1 min-w-0 border-0 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 hover:flex-[4] overflow-hidden">
              <CardContent className="p-0">
                <Button
                  variant="ghost"
                  className="group w-full h-auto p-2 justify-start hover:bg-transparent transition-all duration-300 ease-in-out overflow-hidden"
                  onClick={handleFindSimilarTasks}
                  disabled={isProcessing}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Search className="h-4 w-4 text-white" />
                  </div>
                  <span className="opacity-100 group-hover:opacity-100 transition-opacity duration-300 ease-in-out whitespace-nowrap flex items-center overflow-hidden">
                    Find Similar ➤
                  </span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              } items-start gap-3 max-w-[85%]`}
            >
              {message.role === "assistant" && (
                <div className="relative">
                  <Avatar className="h-10 w-10 border-2 border-emerald-100 dark:border-emerald-900">
                    <AvatarImage src="/images/turbo/Turbo_logo_64.png" />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-medium">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0 -right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                </div>
              )}

              <div className="flex flex-col space-y-1">
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 workspace-border border shadow-sm"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-r-emerald-400 rounded-full animate-ping"></div>
                      </div>
                      <div className="flex space-x-1 items-center">
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          Thinking
                        </span>
                        <div className="flex space-x-1 items-center">
                          <div
                            className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          ></div>
                          <div
                            className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          ></div>
                          <div
                            className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ) : message.role === "assistant" ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  )}
                </div>
                {message.timestamp && (
                  <div
                    className={`text-xs workspace-text-muted px-1 ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                )}
              </div>

              {message.role === "user" && (
                <Avatar className="h-10 w-10 border-2 border-gray-100 dark:border-gray-700">
                  <AvatarImage
                    src={
                      userProfile?.avatar_url || user.user_metadata?.avatar_url
                    }
                  />
                  <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white text-xs font-medium">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t workspace-border bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={isProcessing}
              className="pr-12 h-12 rounded-xl border-2 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-200 bg-white dark:bg-gray-800"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isProcessing || !input.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs workspace-text-muted">
            <span>Press Enter to send</span>
            <div className="flex items-center space-x-1">
              <Sparkles className="h-3 w-3" />
              <span>Powered by AI</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
