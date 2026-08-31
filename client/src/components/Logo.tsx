import LogoImg from "../assets/logo.jpeg";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={LogoImg}
        alt="SBG BUK Quiz logo"
        width={size}
        height={size}
        className="rounded-xl object-cover"
      />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">SBG BUK Quiz</span>
        <span className="block text-[11px] font-medium text-ink/50 dark:text-fog/50">AWS Student Builder Group</span>
      </span>
    </span>
  );
}