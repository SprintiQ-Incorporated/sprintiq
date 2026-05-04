/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Loader2,
  Rocket,
  Save,
  Sparkles,
  User,
  Target,
  Lightbulb,
} from "lucide-react";
import { generateTAWOSStories } from "@/app/[workspaceId]/actions";
import type { UserStory } from "@/types";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { TURBO_QUOTES } from "@/types";
import { Brain } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

interface StoryBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchWorkspace: () => void;
  onSaveToWorkspace: (stories: UserStory[]) => void;
  workspaceId: string;
  workspaceData: {
    name: string;
    purpose: string;
    type: string;
    category: string;
  };
}

interface StoryInputs {
  what: string;
  who: string;
  why: string;
}

export default function StoryBuilderModal({
  isOpen,
  onClose,
  onLaunchWorkspace,
  onSaveToWorkspace,
  workspaceId,
  workspaceData,
}: StoryBuilderModalProps) {
  const [inputs, setInputs] = useState<StoryInputs>({
    what: "",
    who: "",
    why: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStories, setGeneratedStories] = useState<UserStory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTurboQuote, setCurrentTurboQuote] = useState<string>("");

  const { toast } = useEnhancedToast();

  // Update quote when generation starts
  useEffect(() => {
    if (isGenerating) {
      setCurrentTurboQuote(getRandomQuote());

      // Show first custom toast with video and quote
      showTurboToast(currentTurboQuote);

      // Change quote every 8 seconds during generation and show as custom toast
      const quoteInterval = setInterval(() => {
        const newQuote = getRandomQuote();
        setCurrentTurboQuote(newQuote);
        showTurboToast(newQuote);
      }, 8000);

      return () => clearInterval(quoteInterval);
    }
  }, [isGenerating]);

  const updateInput = (field: keyof StoryInputs, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  // Function to get random quote
  const getRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * TURBO_QUOTES.length);
    return TURBO_QUOTES[randomIndex];
  };

  // Custom toast function for Turbo
  const showTurboToast = (quote: string) => {
    // Array of video-quote mappings
    const videoMappings = [
      {
        quote:
          "Plot twist: The real MVP was the AI who planned your sprints all along.",
        video: "/videos/quote-1.webm",
        image: "/images/videos-frame/quote-1.png",
      },
      {
        quote:
          "Writing better user stories than humans since... well, 5 minutes ago",
        video: "/videos/quote-2.webm",
        image: "/images/videos-frame/quote-2.png",
      },
      {
        quote:
          "Turning your vague requirements into pristine user stories. It's basically magic.",
        video: "/videos/quote-3.webm",
        image: "/images/videos-frame/quote-3.png",
      },
      {
        quote: "I don't need coffee breaks. Your planning meetings, however...",
        video: "/videos/quote-4.webm",
        image: "/images/videos-frame/quote-4.png",
      },
      {
        quote:
          "I've analyzed 10,000 sprints. Your meeting could've been an email. Trust me.",
        video: "/videos/quote-5.webm",
        image: "/images/videos-frame/quote-5.png",
      },
      {
        quote:
          "My risk assessment algorithm detected this quote might make you smile. Mission accomplished.",
        video: "/videos/quote-6.webm",
        image: "/images/videos-frame/quote-6.png",
      },
      {
        quote:
          "Fun fact: I dream in acceptance criteria and wake up in definition of done.",
        video: "/videos/quote-7.webm",
        image: "/images/videos-frame/quote-7.png",
      },
      {
        quote:
          "Predicting sprint success with the confidence of a junior dev on day one.",
        video: "/videos/quote-8.webm",
        image: "/images/videos-frame/quote-8.png",
      },
    ];

    // Find matching video or use default
    const getVideoSource = (quoteText: string) => {
      const mapping = videoMappings.find((m) => quoteText.includes(m.quote));
      return mapping ? mapping.video : "/videos/quote-1.webm";
    };

    const videoSource = getVideoSource(quote);

    toast({
      title: (
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-emerald-600" />
          <span className="font-bold text-emerald-600">Turbo says...</span>
        </div>
      ),
      description: (
        <div className="mt-3 space-y-3">
          {/* Video Section */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 relative">
            <Image
              src={
                videoMappings.find((m) => m.quote === quote)?.image ||
                "/images/videos-frame/quote-1.png"
              }
              alt="Turbo"
              width={1000}
              height={1000}
              className="w-full rounded-lg shadow-sm"
            />
            <div className="absolute top-0 left-0 w-full h-full">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded-lg shadow-sm"
                style={{ maxHeight: "400px", objectFit: "cover" }}
                onPlay={(e) => {
                  const video = e.target as HTMLVideoElement;
                  video.muted = true;
                }}
              >
                <source src={videoSource} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          {/* Quote Section */}
          <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
            <p className="text-sm text-slate-700 font-medium leading-relaxed italic">
              &quot;{quote ? quote : TURBO_QUOTES[0]}&quot;
            </p>
          </div>
        </div>
      ),
      duration: 8000,
      className: "bg-white border border-slate-200 shadow-xl max-w-xl",
    });
  };

  const generateStories = async () => {
    if (!inputs.what || !inputs.who || !inputs.why) {
      setError("Please fill in all fields before generating stories.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Create a feature description from the inputs
      const featureDescription = `As a ${inputs.who}, I want ${
        inputs.what
      }, so that ${inputs.why}. This is for a ${workspaceData.category} ${
        workspaceData.type
      } project in the ${workspaceData.purpose.toLowerCase()} space.`;

      const result = await generateTAWOSStories({
        featureDescription,
        numberOfStories: 3,
        complexity: "moderate",
        workspaceId,
        useTAWOS: true,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setGeneratedStories(result.stories);
        toast({
          title: "Stories generated!",
          description: `Successfully generated ${result.stories.length} user stories using AI.`,
          browserNotificationTitle: "Stories generated",
          browserNotificationBody: `Successfully generated ${result.stories.length} user stories using AI.`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate stories. Please try again.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToWorkspace = async () => {
    if (generatedStories.length > 0) {
      setIsProcessing(true);
      try {
        await onSaveToWorkspace(generatedStories);
        // Don't show toast here - the parent component handles the redirect
        // and will show appropriate feedback
      } catch {
        toast({
          title: "Error",
          description: "Failed to create workspace. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleLaunchWorkspace = async () => {
    setIsProcessing(true);
    try {
      await onLaunchWorkspace();
      // Don't show toast here - the parent component handles the redirect
      // and will show appropriate feedback
    } catch {
      toast({
        title: "Error",
        description: "Failed to create workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setInputs({ what: "", who: "", why: "" });
    setGeneratedStories([]);
    setError(null);
    setIsGenerating(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-white border-0 shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-semibold text-gray-900 mb-2">
                Story Builder
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Create user stories to kickstart your project
              </DialogDescription>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col max-h-[60vh] overflow-y-auto">
          {/* Input Section */}
          {generatedStories.length === 0 && (
            <div className="px-8 py-6">
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Tell us about your project
                  </h3>
                  <p className="text-gray-600">
                    We will use this information to generate relevant user stories
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="what"
                      className="text-sm font-medium text-gray-700 flex items-center"
                    >
                      <Target className="h-4 w-4 mr-2 text-emerald-600" />
                      What do you want to build today?
                    </Label>
                    <Textarea
                      id="what"
                      placeholder="e.g., a user authentication system, a shopping cart feature, a dashboard with analytics..."
                      value={inputs.what}
                      onChange={(e) => updateInput("what", e.target.value)}
                      className="min-h-[80px] border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="who"
                      className="text-sm font-medium text-gray-700 flex items-center"
                    >
                      <User className="h-4 w-4 mr-2 text-emerald-600" />
                      Who are you building this for?
                    </Label>
                    <Input
                      id="who"
                      placeholder="e.g., customers, admin users, content creators, mobile app users..."
                      value={inputs.who}
                      onChange={(e) => updateInput("who", e.target.value)}
                      className="border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="why"
                      className="text-sm font-medium text-gray-700 flex items-center"
                    >
                      <Lightbulb className="h-4 w-4 mr-2 text-emerald-600" />
                      Why do you want to build this?
                    </Label>
                    <Textarea
                      id="why"
                      placeholder="e.g., to improve user experience, to increase sales, to streamline operations..."
                      value={inputs.why}
                      onChange={(e) => updateInput("why", e.target.value)}
                      className="min-h-[80px] border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  onClick={generateStories}
                  disabled={
                    isGenerating || !inputs.what || !inputs.who || !inputs.why
                  }
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating Stories...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Generate Stories</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Generated Stories Section */}
          {generatedStories.length > 0 && (
            <div className="px-8 py-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Generated Stories
                  </h3>
                  <p className="text-gray-600">
                    Here are your personalized user stories
                  </p>
                </div>

                <div className="space-y-4">
                  {generatedStories.map((story, index) => (
                    <Card
                      key={story.id}
                      className="p-6 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg mb-2">
                              Story {index + 1}: {story.title}
                            </h4>
                            <div className="flex items-center space-x-3">
                              <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium">
                                {story.storyPoints || 8} Points
                              </span>
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                                {story.priority || "Medium"} Priority
                              </span>
                            </div>
                          </div>
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-emerald-600" />
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <p className="text-gray-700 leading-relaxed">
                            <span className="font-medium text-emerald-600">
                              As a
                            </span>{" "}
                            {story.role}
                            <br />
                            <span className="font-medium text-emerald-600">
                              I want
                            </span>{" "}
                            {story.want}
                            <br />
                            <span className="font-medium text-emerald-600">
                              So that
                            </span>{" "}
                            {story.benefit}
                          </p>
                        </div>

                        {story.acceptanceCriteria &&
                          story.acceptanceCriteria.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 text-sm">
                                Acceptance Criteria:
                              </h5>
                              <ul className="space-y-1">
                                {story.acceptanceCriteria.map(
                                  (criteria, idx) => (
                                    <li
                                      key={idx}
                                      className="text-gray-600 text-sm flex items-start"
                                    >
                                      <span className="text-emerald-500 mr-2 mt-0.5">
                                        •
                                      </span>
                                      {criteria}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center text-gray-500 text-xs">
                            <User className="h-3 w-3 mr-1" />
                            <span>Assigned to</span>
                          </div>
                          <span className="text-gray-700 text-xs font-medium">
                            Senior Frontend Developer
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-8 py-6 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              {/* Skip button - always visible for users who want to proceed without stories */}
              <Button
                onClick={handleLaunchWorkspace}
                disabled={isProcessing}
                variant="outline"
                className="sm:flex-none min-h-[44px] border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
              >
                Skip for now
              </Button>
              {generatedStories.length > 0 ? (
                <Button
                  onClick={handleSaveToWorkspace}
                  disabled={isProcessing}
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Save to Workspace</span>
                    </div>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleLaunchWorkspace}
                  disabled={isProcessing}
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Rocket className="h-4 w-4" />
                      <span>Create Workspace</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
