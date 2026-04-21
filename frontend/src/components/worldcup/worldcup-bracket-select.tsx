'use client';

import {
  formatWorldCupRoundLabel,
  worldcupSelectableBracketSizes,
} from '@/lib/worldcup/worldcup-bracket-sizes';

type Props = {
  templateTitle: string;
  totalItems: number;
  onSelectBracket: (bracketSize: number) => void;
};

export function WorldCupBracketSelect({ templateTitle, totalItems, onSelectBracket }: Props) {
  const sizes = worldcupSelectableBracketSizes(totalItems);

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-lg text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          이상형 월드컵
        </p>
        <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">{templateTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          총 <span className="font-semibold text-zinc-900 dark:text-zinc-200">{totalItems}</span>명의 후보가 대기 중입니다!{' '}
          진행할 라운드를 선택해 주세요.
          <br />
          선택받지 못한 후보들은 게임 중 교체(리롤) 찬스에 등장합니다.
        </p>
      </div>

      {sizes.length === 0 ? (
        <p className="text-center text-sm text-rose-600 dark:text-rose-400">
          16강 이상으로 플레이하려면 후보가 16명 이상이어야 해요.
        </p>
      ) : (
        <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3">
          {sizes.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSelectBracket(n)}
              className="min-w-[5.5rem] rounded-2xl border border-violet-200 bg-white px-5 py-4 text-sm font-semibold text-violet-900 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800/60 dark:bg-zinc-900 dark:text-violet-100 dark:hover:border-violet-500 dark:hover:bg-violet-950/50"
            >
              {formatWorldCupRoundLabel(n)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
