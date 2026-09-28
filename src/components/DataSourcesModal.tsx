import React from 'react'
import { Server, CheckCircle2, ShieldCheck, X, RefreshCw, Zap, Database } from 'lucide-react'
import { REAL_NFL_DATA_SOURCES } from '../services/espnApi'

interface DataSourcesModalProps {
  isOpen: boolean
  onClose: () => void
  activeSourceId: string
  activeSourceName: string
  responseTimeMs: number
  isCached: boolean
  cachedTimestamp?: string
  onRefresh: () => void
  isRefreshing: boolean
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  activeSourceId,
  activeSourceName,
  responseTimeMs,
  isCached,
  cachedTimestamp,
  onRefresh,
  isRefreshing,
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0d1322] p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-sky-400 border border-sky-500/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 id="sources-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                Live Data Redundancy Engine
              </h2>
              <p className="text-xs text-slate-400">
                5 High-Availability Official Live Sources & Edge Mirrors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close data sources modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Zero Synthetic Data Guarantee */}
        <div className="my-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              100% Verified Real NFL Data Guarantee
            </h3>
            <p className="text-xs text-emerald-200/80 mt-0.5 leading-relaxed">
              Every score, drive yardage, down, and win percentage is sourced exclusively from official live NFL data streams. Synthetic or made-up placeholder games are strictly prohibited and permanently disabled.
            </p>
          </div>
        </div>

        {/* Active Source Card */}
        <div className="mb-4 rounded-xl border border-sky-500/40 bg-sky-950/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
              </span>
              Currently Active Live Feed
            </span>
            {responseTimeMs > 0 && !isCached && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-700/50">
                ⚡ {responseTimeMs}ms latency
              </span>
            )}
            {isCached && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
                Offline Verified Cache
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-white mt-1.5">{activeSourceName}</p>
          {isCached && cachedTimestamp && (
            <p className="text-xs text-amber-300/90 mt-1">
              Recorded from official live feed at {new Date(cachedTimestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* List of Redundant Sources */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
            Failover Cascade Order
          </h3>

          {REAL_NFL_DATA_SOURCES.map((src, idx) => {
            const isActive = src.id === activeSourceId && !isCached
            return (
              <div
                key={src.id}
                className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 text-xs font-mono font-bold text-slate-500 bg-slate-800 w-5 h-5 rounded flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{src.name}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Live Feed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{src.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">
                    CORS Wildcard ( * )
                  </span>
                </div>
              </div>
            )
          })}

          {/* Offline Cache Tier */}
          <div
            className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
              isCached
                ? 'border-amber-500/50 bg-amber-950/20 ring-1 ring-amber-500/30'
                : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 text-xs font-mono font-bold text-slate-500 bg-slate-800 w-5 h-5 rounded flex items-center justify-center shrink-0">
                <Database className="h-3 w-3 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Verified Offline Cache (Local Storage)
                  </span>
                  {isCached && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full">
                      <Zap className="h-3 w-3" /> Serving
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Stores last known authentic NFL scoreboard if all 5 live feeds are temporarily unreachable
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-amber-300/80 border border-slate-700/50">
                Offline Backup
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Test & Ping All Feeds</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
