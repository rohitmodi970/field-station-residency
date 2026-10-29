'use client';

import React, { useState, useCallback } from 'react';

export interface DebugEntry {
  source: string;
  icon: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  latencyMs?: number;
  rawData?: unknown;
  error?: string;
  timestamp: string;
}

interface DebugPanelProps {
  entries: DebugEntry[];
  title?: string;
}

function StatusDot({ status }: { status: DebugEntry['status'] }) {
  const colors: Record<DebugEntry['status'], string> = {
    pending: 'bg-yellow-400 animate-pulse',
    success: 'bg-emerald-400',
    error: 'bg-red-400',
    skipped: 'bg-gray-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function DataTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null) return <span className="text-gray-400 italic">null</span>;
  if (data === undefined) return <span className="text-gray-400 italic">undefined</span>;
  if (typeof data === 'boolean') return <span className="text-purple-400">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'string') {
    const display = data.length > 300 ? data.slice(0, 300) + '…' : data;
    return <span className="text-green-300 break-all">"{display}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-yellow-300 hover:text-yellow-100 font-mono text-xs cursor-pointer"
        >
          [{collapsed ? `…${data.length} items` : ''}]
        </button>
        {!collapsed && (
          <div className="ml-3 border-l border-gray-600 pl-2 mt-0.5 space-y-0.5">
            {data.map((item, i) => (
              <div key={i} className="flex gap-1 text-xs">
                <span className="text-gray-500 shrink-0">[{i}]</span>
                <DataTree data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data as object);
    if (keys.length === 0) return <span className="text-gray-400">{'{}'}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-yellow-300 hover:text-yellow-100 font-mono text-xs cursor-pointer"
        >
          {'{'}
          {collapsed ? `…${keys.length} keys` : ''}
          {'}'}
        </button>
        {!collapsed && (
          <div className="ml-3 border-l border-gray-600 pl-2 mt-0.5 space-y-0.5">
            {keys.map((key) => (
              <div key={key} className="flex gap-1 text-xs flex-wrap">
                <span className="text-red-300 shrink-0">"{key}":</span>
                <DataTree data={(data as Record<string, unknown>)[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="text-gray-300">{String(data)}</span>;
}

function CopyButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  }, [data]);
  return (
    <button
      onClick={handleCopy}
      className="text-[9px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors cursor-pointer"
    >
      {copied ? '✓ Copied' : 'Copy JSON'}
    </button>
  );
}

/** Shows SDK diagnostic info embedded in the rawData by OnairosConnectFork */
function SdkDiagnosticBadges({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, any>;
  if (!('_sdk_keys' in d)) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
        d._sdk_had_apiResponse ? 'bg-emerald-900 text-emerald-300' : 'bg-orange-900 text-orange-300'
      }`}>
        {d._sdk_had_apiResponse ? 'apiResponse: POPULATED' : 'apiResponse: EMPTY'}
      </span>
      {d._resolved_from && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-900 text-blue-300">
          resolved via: {d._resolved_from}
        </span>
      )}
      {Array.isArray(d._sdk_keys) && d._sdk_keys.length > 0 && (
        <span className="text-[9px] text-gray-500 italic">
          SDK keys: [{(d._sdk_keys as string[]).filter((k) => !k.startsWith('_')).join(', ')}]
        </span>
      )}
    </div>
  );
}

export default function DebugPanel({ entries, title = 'Debug — Raw Server Payloads' }: DebugPanelProps) {
  const [open, setOpen] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [rawJsonMode, setRawJsonMode] = useState(false);

  // Only show in dev (or via ?debug=1)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    const url = new URLSearchParams(window.location.search);
    if (url.get('debug') !== '1') return null;
  }

  const selected = selectedSource
    ? entries.find((e) => e.source === selectedSource)
    : entries[0] ?? null;

  const successCount = entries.filter((e) => e.status === 'success').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[min(96vw,600px)] rounded-2xl border border-gray-700 bg-gray-900/98 shadow-2xl shadow-black/50 backdrop-blur-xl font-mono text-xs"
      style={{ maxHeight: open ? 540 : 44, transition: 'max-height 0.3s ease' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">🛠</span>
          <span className="text-gray-200 font-semibold text-xs tracking-wide">{title}</span>
          <span className="text-gray-500 text-[10px]">({entries.length} sources)</span>
          {successCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900 text-emerald-300 font-bold">
              {successCount} OK
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900 text-red-300 font-bold">
              {errorCount} ERR
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
            }}
            className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer"
          >
            Copy All JSON
          </button>
          <span className="flex gap-1">
            {entries.map((e) => (
              <StatusDot key={e.source} status={e.status} />
            ))}
          </span>
          <span className="text-gray-400 text-lg leading-none">{open ? '▼' : '▲'}</span>
        </div>
      </div>

      {open && (
        <div className="flex h-[480px]">
          {/* Left sidebar — source list */}
          <div className="w-40 shrink-0 border-r border-gray-700 overflow-y-auto">
            {entries.map((e) => (
              <button
                key={e.source}
                onClick={() => setSelectedSource(e.source)}
                className={[
                  'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 border-b border-gray-800 transition-colors cursor-pointer',
                  selectedSource === e.source || (!selectedSource && entries[0]?.source === e.source)
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-800/60',
                ].join(' ')}
              >
                <div className="flex items-center gap-1.5">
                  <StatusDot status={e.status} />
                  <span className="truncate text-[11px] font-semibold">{e.icon} {e.source}</span>
                </div>
                {e.latencyMs !== undefined && (
                  <span className="text-[9px] text-gray-500 pl-3.5">{e.latencyMs}ms</span>
                )}
                <span className="text-[9px] text-gray-600 pl-3.5">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>

          {/* Right pane — raw data */}
          <div className="flex-1 overflow-y-auto p-3">
            {selected ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status={selected.status} />
                    <span className="text-gray-200 font-semibold text-[11px]">
                      {selected.icon} {selected.source}
                    </span>
                    <span
                      className={[
                        'text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                        selected.status === 'success' ? 'bg-emerald-900 text-emerald-300' :
                        selected.status === 'error' ? 'bg-red-900 text-red-300' :
                        selected.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-gray-800 text-gray-400'
                      ].join(' ')}
                    >
                      {selected.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selected.latencyMs !== undefined && (
                      <span className="text-[10px] text-gray-500">{selected.latencyMs}ms</span>
                    )}
                    <button
                      onClick={() => setRawJsonMode((m) => !m)}
                      className="text-[9px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors cursor-pointer"
                    >
                      {rawJsonMode ? 'Tree view' : 'Raw JSON'}
                    </button>
                    {selected.rawData !== undefined && <CopyButton data={selected.rawData} />}
                  </div>
                </div>

                {/* SDK diagnostic badges */}
                <SdkDiagnosticBadges data={selected.rawData} />

                {selected.error && (
                  <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-red-300 text-[11px]">
                    ❌ {selected.error}
                  </div>
                )}

                <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 overflow-x-auto max-h-80 overflow-y-auto">
                  {selected.rawData !== undefined ? (
                    rawJsonMode ? (
                      <pre className="text-[10px] text-green-200 whitespace-pre-wrap break-all">
                        {JSON.stringify(selected.rawData, null, 2)}
                      </pre>
                    ) : (
                      <DataTree data={selected.rawData} depth={0} />
                    )
                  ) : (
                    <span className="text-gray-500 italic">No data yet — waiting for this source to respond...</span>
                  )}
                </div>

                <div className="text-[9px] text-gray-600">
                  Last updated: {new Date(selected.timestamp).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-[11px]">
                Select a source to inspect its raw payload
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
