"use client";
export default function JournalError({ error }: { error: Error }) {
  return <div className="text-red-600 p-4">Journal error: {error.message}</div>;
}
