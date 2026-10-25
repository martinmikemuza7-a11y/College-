import React from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { QueuedUploadItem } from '../types';

interface UploadQueueWidgetProps {
  uploadQueue: QueuedUploadItem[];
  isQueueMinimized: boolean;
  onToggleMinimized: () => void;
  onClearCompleted: () => void;
  onRemoveItem: (id: string) => void;
  onRetryItem: (item: QueuedUploadItem) => void;
  onNavigateToTutor?: () => void;
}

export const UploadQueueWidget: React.FC<UploadQueueWidgetProps> = ({
  uploadQueue,
  isQueueMinimized,
  onToggleMinimized,
  onClearCompleted,
  onRemoveItem,
  onRetryItem,
  onNavigateToTutor,
}) => {
  if (uploadQueue.length === 0) return null;

  const inProgressCount = uploadQueue.filter(
    (i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'indexing'
  ).length;
  const readyCount = uploadQueue.filter((i) => i.status === 'ready').length;
  const errorCount = uploadQueue.filter((i) => i.status === 'error').length;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm sm:max-w-md w-full animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div
          onClick={onToggleMinimized}
          className="px-4 py-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {inProgressCount > 0 ? (
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : errorCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            <div>
              <span className="text-xs font-bold block leading-tight">
                {inProgressCount > 0
                  ? `Indexing Vectors (${inProgressCount} in progress)`
                  : errorCount > 0
                  ? `Indexing Complete with ${errorCount} notice(s)`
                  : `All ${readyCount} Documents Indexed`}
              </span>
              <span className="text-[10px] text-slate-300 block">
                {uploadQueue.length} document{uploadQueue.length === 1 ? '' : 's'} queued
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {readyCount > 0 && onNavigateToTutor && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToTutor();
                }}
                className="px-2 py-1 bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/40 rounded-lg text-[10px] font-bold text-indigo-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Bot className="w-3 h-3" />
                <span>Ask AI</span>
              </button>
            )}

            <button
              type="button"
              className="p-1 hover:bg-white/10 rounded-lg transition"
              aria-label={isQueueMinimized ? 'Expand' : 'Minimize'}
            >
              {isQueueMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Items List */}
        {!isQueueMinimized && (
          <div className="p-3 bg-slate-50 max-h-64 overflow-y-auto space-y-2 border-t border-slate-100 text-xs">
            {uploadQueue.map((item) => {
              const isDone = item.status === 'ready';
              const isError = item.status === 'error';
              const isWorking = item.status === 'uploading' || item.status === 'indexing';

              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-800 truncate block">
                        {item.customTitle || item.filename}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Scope: {item.targetFolderName} • {(item.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isError && (
                        <button
                          onClick={() => onRetryItem(item)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Status Message */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span
                        className={`font-semibold ${
                          isDone
                            ? 'text-emerald-700'
                            : isError
                            ? 'text-amber-700'
                            : 'text-indigo-700'
                        }`}
                      >
                        {item.statusMessage || (isWorking ? 'Processing & embedding…' : 'Queued')}
                      </span>
                      <span className="font-mono text-slate-500">{item.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isDone
                            ? 'bg-emerald-500'
                            : isError
                            ? 'bg-amber-500'
                            : 'bg-indigo-600 animate-pulse'
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {readyCount > 0 && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClearCompleted}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  Clear Completed ({readyCount})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
