export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" className="fill-ink dark:fill-paper" />
        <path d="M14 40 24 18h5L39 40h-5.4l-2-4.8H21.2l-2 4.8H14Zm9-9.2h6.8L26.4 22 23 30.8Z" fill="#FF9900" />
        <rect x="42" y="18" width="8" height="8" rx="2" fill="#FF9900" />
        <rect x="42" y="32" width="8" height="8" rx="2" className="fill-paper dark:fill-ink" opacity=".9" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">SBG BUK Quiz</span>
        <span className="block text-[11px] font-medium text-ink/50 dark:text-fog/50">AWS Student Builder Group</span>
      </span>
    </span>
  );
}
