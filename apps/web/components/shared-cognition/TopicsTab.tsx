"use client";

interface TopicsTabProps {
  topics: string[];
}

export function TopicsTab({ topics }: TopicsTabProps) {
  return topics.length > 0 ? (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-base text-[#2E2012]">Shared topics</h2>
        <p className="mt-1 text-xs text-[#7A5A3A]">Themes that emerge from what you share together.</p>
      </div>
      <div className="flex flex-wrap gap-2.5 rounded-xl border border-[#E6DFD5] bg-[#FFFDF9] p-5">
        {topics.map((topic) => (
          <span key={topic} className="rounded-full border border-[#DCCDBD] bg-[#F4EDE2] px-3.5 py-2 text-xs font-medium text-[#7A5A3A]">{topic}</span>
        ))}
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-6 py-12 text-center text-xs text-[#7A5A3A]">No shared topics yet.</div>
  );
}
