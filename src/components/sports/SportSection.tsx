import type { Game, Market } from "@/lib/types";
import { getSportLabel, getSportIcon } from "@/lib/types";
import GameRow from "./GameRow";

interface SportSectionProps {
  sport: string;
  games: Game[];
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function SportSection({
  sport,
  games,
  markets,
  onSelectBet,
}: SportSectionProps) {
  if (games.length === 0) return null;

  return (
    <section className="space-y-0.5">
      {/* Sport header with column labels */}
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] md:grid-cols-[minmax(0,1fr)_repeat(3,80px)] gap-0.5 items-center px-0">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-sm">{getSportIcon(sport)}</span>
          <span className="text-xs font-semibold text-white">
            {getSportLabel(sport)}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
          SPREAD
        </span>
        <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
          TOTAL
        </span>
        <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
          MONEY
        </span>
      </div>

      {/* Game rows */}
      {games.map((game) => (
        <GameRow
          key={game.id}
          game={game}
          markets={markets.filter((m) => m.game_id === game.id)}
          onSelectBet={onSelectBet}
        />
      ))}
    </section>
  );
}
