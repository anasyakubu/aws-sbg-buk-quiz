import { ReactNode } from 'react';
import { Loader2, Inbox } from 'lucide-react';

export const Spinner = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <Loader2 className={`${className} animate-spin`} aria-label="Loading" />
);

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Inbox className="h-9 w-9 text-ink/25 dark:text-fog/25" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">{hint}</p>
      </div>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-20" />)}
    </div>
  );
}

export function Field({ label, htmlFor, children, error }: { label: string; htmlFor?: string; children: ReactNode; error?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
