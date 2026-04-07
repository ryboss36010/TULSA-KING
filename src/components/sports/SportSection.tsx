import type { Game, Market } from "@/lib/types";
import { getSportLabel } from "@/lib/types";
import SportIcon from "@/components/icons/SportIcon";
import GameRow from "./GameRow";

interface SportSectionProps {
  sport: string;
  games: Game[];
  markets: Market[];
}

export default function SportSection({
  sport,
  games,
  markets,
}: SportSectionProps) {
  if (games.length === 0) return null;

  return (
    <section className="space-y-1">
      {/* Sport header with column labels */}
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,56px)] sm:grid-cols-[minmax(0,1fr)_repeat(3,72px)] md:grid-cols-[minmax(0,1fr)_repeat(3,96px)] gap-0.5 sm:gap-1 items-center">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
          <SportIcon sport={sport} className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="text-sm font-bold text-white">
            {getSportLabel(sport)}
          </span>
        </div>
        <span className="text-[10px] sm:text-xs text-[var(--text-muted)] text-center font-semibold">
          SPREAD
        </span>
        <span className="text-[10px] sm:text-xs text-[var(--text-muted)] text-center font-semibold">
          TOTAL
        </span>
        <span className="text-[10px] sm:text-xs text-[var(--text-muted)] text-center font-semibold">
          MONEY
        </span>
      </div>

      <div className="space-y-1">
        {games.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            markets={markets.filter((m) => m.game_id === game.id)}
          />
        ))}
      </div>
    </section>
  );
}
