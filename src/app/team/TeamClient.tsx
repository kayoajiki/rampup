"use client";

import { useState } from "react";

type Props = {
  memberName: string;
  memberEmail: string;
};

export default function TeamClient({
  memberName,
  memberEmail,
}: Props) {
  const [copied, setCopied] = useState(false);

  const message = `${memberName}さん、rampupの診断をお願いします！あなたの特性を活かした関わりができるよう、ぜひやってみてください。`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "border-[#E9E9E7] text-[#9B9A97] hover:border-[#37352F] hover:text-[#37352F]"
      }`}
    >
      {copied ? "コピーしました ✓" : "促す"}
    </button>
  );
}
