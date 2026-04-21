import { WorldCupSessionClient } from './worldcup-session-client';

interface WorldCupPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorldCupTemplatePage(props: WorldCupPageProps) {
  const { id } = await props.params;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorldCupSessionClient key={id} templateId={id} />
    </div>
  );
}
