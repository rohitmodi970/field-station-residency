"use client"

import React from 'react';
import { Lightbulb, ArrowRight } from "lucide-react";
import CollapsibleCard from '@/components/CollapsibleCard';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/posthog-events';
import { buildJournalNewUrl, setJournalPromptContext } from '@/lib/journal/new-entry-navigation';

interface PromptData {
  text: string;
  explanation: string;
}

const DailyPrompt = ({ prompt }: { prompt: PromptData }) => {
  const router = useRouter();

  const handleNewEntry = () => {
    // Track prompt interaction
    trackEvent.searchPerformed({
      results_count: 1,
      context: 'journals',
      query_length: 0,
    });
    setJournalPromptContext({ text: prompt.text, explanation: prompt.explanation });
    router.push(buildJournalNewUrl({ source: 'dashboard_prompt' }));
  };

  return (
    <CollapsibleCard 
      title="Today's Writing Prompt" 
      icon={<Lightbulb className="h-5 w-5" />}
      defaultOpen={true}
    >
      <div className="bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 rounded-lg">
        <p
          className="text-md font-medium cursor-pointer"
          onClick={handleNewEntry}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleNewEntry()}
        >
          {prompt.text}
        </p>
        <p
          className="text-sm text-muted-foreground mt-2 cursor-pointer"
          onClick={handleNewEntry}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleNewEntry()}
        >
          {prompt.explanation}
        </p>
        <div className="flex justify-end mt-4">
          <button 
            onClick={handleNewEntry}
            className="text-primary flex items-center text-sm font-medium hover:underline"
          >
            Start expressing
            <ArrowRight className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>
    </CollapsibleCard>
  );
};

export default DailyPrompt;