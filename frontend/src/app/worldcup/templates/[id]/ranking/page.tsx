import { WorldCupRankingRoute } from './worldcup-ranking-route';

interface WorldCupRankingPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorldCupRankingPage(props: WorldCupRankingPageProps) {
  const { id } = await props.params;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorldCupRankingRoute templateId={id} />
    </div>
  );
}
