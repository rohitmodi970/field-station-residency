import { redirect } from 'next/navigation';

export default function SentimentAnalysisRedirect() {
  redirect('/analysis/entries');
}
