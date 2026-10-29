"use client";

import { useRef } from "react";

export type WorkspaceTab = "entries" | "prompts" | "topics";

interface WorkspaceTabsProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  counts: Record<WorkspaceTab, number>;
  children: React.ReactNode;
}

const tabs: { id: WorkspaceTab; label: string }[] = [
  { id: "entries", label: "Entries" },
  { id: "prompts", label: "Prompts" },
  { id: "topics", label: "Topics" },
];

export function WorkspaceTabs({ activeTab, onTabChange, counts, children }: WorkspaceTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;

    const nextTab = tabs[nextIndex];
    if (!nextTab) return;

    event.preventDefault();
    onTabChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Connection workspace"
        onKeyDown={handleKeyDown}
        className="flex border-b border-[#DCCDBD]"
      >
        {tabs.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-1 px-3 py-3 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none ${
                selected ? "text-[#9F6958]" : "text-[#8B7665] hover:text-[#5F493C]"
              }`}
            >
              {tab.label} ({counts[tab.id]})
              <span className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#9F6958] transition-opacity duration-150 motion-reduce:transition-none ${selected ? "opacity-100" : "opacity-0"}`} />
            </button>
          );
        })}
      </div>
      <div className="pt-5">
        <div className="animate-in fade-in duration-150 motion-reduce:animate-none">{children}</div>
      </div>
    </div>
  );
}
