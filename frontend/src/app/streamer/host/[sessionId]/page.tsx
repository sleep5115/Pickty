import { HostClient } from './host-client';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function StreamerHostPage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HostClient key={sessionId} sessionId={sessionId} />
    </div>
  );
}
