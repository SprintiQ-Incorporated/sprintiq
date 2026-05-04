"use client";

import { toast } from "sonner";
import Image from "next/image";

const turboToastMessages = [
  "You're in. Let's build something great.",
  "Got it. Don't make it weird.",
  "Account created. I'm on it.",
  "You're in. I'll be in touch. Probably with too much enthusiasm.",
];

export function showTurboWelcomeToast() {
  const randomMessage =
    turboToastMessages[Math.floor(Math.random() * turboToastMessages.length)];

  toast.custom(
    () => (
      <div className="flex items-start gap-3 bg-gradient-to-br from-[#1e1b4b] to-[#312e81] border border-indigo-600 rounded-xl p-4 max-w-[320px] shadow-[0_10px_40px_rgba(99,102,241,0.3)]">
        <Image
          src="/images/turbo/Turbo_logo_96.png"
          alt="Turbo"
          width={48}
          height={48}
          className="rounded-full flex-shrink-0 w-12 h-12 object-contain"
        />
        <div className="flex flex-col gap-1">
          <p className="text-indigo-100 text-sm leading-relaxed m-0">
            {randomMessage}
          </p>
          <span className="text-indigo-300 text-xs italic">— Turbo</span>
        </div>
      </div>
    ),
    {
      duration: 5000,
      position: "bottom-right",
    }
  );
}
