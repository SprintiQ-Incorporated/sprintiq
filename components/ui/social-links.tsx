import { FacebookSvg } from "@/components/svg/FacebookSvg";
import { TwitterSvg } from "@/components/svg/TwitterSvg";
import { InstagramSvg } from "@/components/svg/InstagramSvg";
import { LinkedInSvg } from "@/components/svg/LinkedInSvg";
import { MediumSvg } from "@/components/svg/MediumSvg";
import { YouTubeSvg } from "@/components/svg/YouTubeSvg";
import { GitHubSvg } from "@/components/svg/GitHubSvg";
import { WebsiteSvg } from "@/components/svg/WebsiteSvg";

interface LinkData {
  type: string;
  url: string;
}

interface SocialLinksProps {
  links: LinkData[];
  className?: string;
}

const getSocialIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "facebook":
      return FacebookSvg;
    case "twitter":
      return TwitterSvg;
    case "instagram":
      return InstagramSvg;
    case "linkedin":
      return LinkedInSvg;
    case "medium":
      return MediumSvg;
    case "youtube":
      return YouTubeSvg;
    case "github":
      return GitHubSvg;
    case "website":
    case "blog":
    case "other":
    default:
      return WebsiteSvg;
  }
};

export const SocialLinks = ({ links, className = "" }: SocialLinksProps) => {
  if (!links || links.length === 0) return null;

  const handleLinkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {links.map((link, index) => {
        const IconComponent = getSocialIcon(link.type);

        return (
          <button
            key={index}
            onClick={() => handleLinkClick(link.url)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 group"
            title={`Visit ${link.type}`}
          >
            <div className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200 transition-colors">
              <IconComponent color="currentColor" />
            </div>
          </button>
        );
      })}
    </div>
  );
};
