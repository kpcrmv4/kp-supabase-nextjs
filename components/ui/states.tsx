'use client';
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-card bg-line" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-card p-8 text-center">
      <CircleAlert className="text-urgent" size={32} />
      <p className="text-sm text-muted">โหลดข้อมูลไม่สำเร็จ</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:opacity-90"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-card p-8 text-center">
      <Inbox className="text-muted" size={32} />
      <p className="text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

export function PendingButton({
  pending, children, className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending: boolean }) {
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 ${className ?? ''}`}
    >
      {pending && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
