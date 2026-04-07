"use client";

interface SportIconProps {
  sport: string;
  className?: string;
}

export default function SportIcon({ sport, className = "w-5 h-5" }: SportIconProps) {
  const key = getSportIconKey(sport);
  const Icon = SPORT_SVG_ICONS[key] || DefaultSportIcon;
  return <Icon className={className} />;
}

function getSportIconKey(sport: string): string {
  if (sport.startsWith("americanfootball")) return "football";
  if (sport.startsWith("basketball")) return "basketball";
  if (sport.startsWith("baseball")) return "baseball";
  if (sport.startsWith("icehockey")) return "hockey";
  if (sport.startsWith("soccer")) return "soccer";
  if (sport.startsWith("golf")) return "golf";
  if (sport.startsWith("tennis")) return "tennis";
  if (sport.startsWith("mma") || sport.startsWith("boxing")) return "fighting";
  if (sport.startsWith("motorsport")) return "racing";
  return "default";
}

function IconWrapper({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function FootballIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-30 12 12)" />
      <path d="M6.5 6.5L17.5 17.5" />
      <path d="M9 8l1.5 1.5M11 10l1.5 1.5M13 12l1.5 1.5M15 14l1.5 1.5" />
    </IconWrapper>
  );
}

function BasketballIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
      <path d="M5.5 5.5c3.5 3 3.5 10 0 13" />
      <path d="M18.5 5.5c-3.5 3-3.5 10 0 13" />
    </IconWrapper>
  );
}

function BaseballIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 3.5c2 3 2 7 0 10s-2 7 0 10" />
      <path d="M17.5 3.5c-2 3-2 7 0 10s2 7 0 10" />
    </IconWrapper>
  );
}

function HockeyIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M4 18l7-14h2l7 14" />
      <path d="M6 14h12" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </IconWrapper>
  );
}

function SoccerIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l2.5 4.5h5L17 12l2.5 4.5h-5L12 21l-2.5-4.5h-5L7 12l-2.5-4.5h5L12 3z" />
    </IconWrapper>
  );
}

function GolfIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M12 3v14" />
      <path d="M12 3l7 5-7 4" />
      <path d="M8 21c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </IconWrapper>
  );
}

function TennisIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M4 12c0-4 3.5-8 8-8" />
      <path d="M20 12c0 4-3.5 8-8 8" />
      <path d="M3 12h18" />
    </IconWrapper>
  );
}

function FightingIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M18 4a3 3 0 00-3 3v4l-3 1-3-1V7a3 3 0 00-6 0v6c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6V7a3 3 0 00-3-3z" />
    </IconWrapper>
  );
}

function RacingIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 3h9v9H3zM12 12h9v9h-9z" fill="currentColor" />
      <path d="M12 3h9v9h-9zM3 12h9v9H3z" />
    </IconWrapper>
  );
}

function DefaultSportIcon({ className }: { className: string }) {
  return (
    <IconWrapper className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </IconWrapper>
  );
}

const SPORT_SVG_ICONS: Record<string, React.FC<{ className: string }>> = {
  football: FootballIcon,
  basketball: BasketballIcon,
  baseball: BaseballIcon,
  hockey: HockeyIcon,
  soccer: SoccerIcon,
  golf: GolfIcon,
  tennis: TennisIcon,
  fighting: FightingIcon,
  racing: RacingIcon,
  default: DefaultSportIcon,
};

