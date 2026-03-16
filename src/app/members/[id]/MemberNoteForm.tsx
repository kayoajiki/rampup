"use client";

import { useState } from "react";

export default function MemberNoteForm({
  memberId,
}: { memberId: string }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/member-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, content }),
      });
      if (res.ok) {
        setContent("");
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          window.location.reload();
        }, 800);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="気づいたことをメモ...（Slackコピペ・箇条書きOK）"
        className="flex-1 text-sm border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] text-[#37352F] placeholder:text-[#9B9A97]"
        rows={2}
      />
      <button
        type="submit"
        disabled={!content.trim() || saving}
        className="text-xs bg-[#1A6CF6] text-white px-3 py-2 rounded-lg disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors self-end"
      >
        {saved ? "✓" : saving ? "..." : "追加"}
      </button>
    </form>
  );
}
