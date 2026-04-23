import { apiFetch } from '@/lib/api-fetch';

export type InteractionTargetType =
  | 'TIER_TEMPLATE'
  | 'TIER_RESULT'
  | 'WORLDCUP_TEMPLATE'
  | 'WORLDCUP_RESULT'
  | 'COMMUNITY_POST';

export type ReactionType = 'LIKE' | 'UPVOTE' | 'DOWNVOTE';

export interface ReactionToggleResult {
  active: boolean;
  reactionType: ReactionType | null;
}

export interface Comment {
  id: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  authorName: string | null;
  authorIpPrefix: string | null;
  memberNickname: string | null;
  authorUserId: number | null;
}

export interface CommentPage {
  content: Comment[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

function parseComment(row: Record<string, unknown>): Comment {
  const pid = row.parentCommentId ?? row.parent_comment_id;
  const uid = row.authorUserId ?? row.author_user_id;
  let authorUserId: number | null = null;
  if (uid != null && uid !== '') {
    const n = typeof uid === 'number' ? uid : Number(uid);
    if (Number.isFinite(n)) authorUserId = n;
  }
  return {
    id: row.id != null ? String(row.id) : '',
    body: typeof row.body === 'string' ? row.body : '',
    parentCommentId:
      pid === null || pid === undefined || pid === '' ? null : String(pid),
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : typeof row.created_at === 'string'
          ? row.created_at
          : '',
    authorName:
      typeof row.authorName === 'string'
        ? row.authorName
        : typeof row.author_name === 'string'
          ? row.author_name
          : null,
    authorIpPrefix:
      typeof row.authorIpPrefix === 'string'
        ? row.authorIpPrefix
        : typeof row.author_ip_prefix === 'string'
          ? row.author_ip_prefix
          : null,
    memberNickname:
      typeof row.memberNickname === 'string'
        ? row.memberNickname
        : typeof row.member_nickname === 'string'
          ? row.member_nickname
          : null,
    authorUserId,
  };
}

export function parseCommentPage(body: Record<string, unknown>): CommentPage {
  const rawContent = body.content;
  const content = Array.isArray(rawContent)
    ? rawContent
        .filter((x) => x && typeof x === 'object')
        .map((row) => parseComment(row as Record<string, unknown>))
    : [];
  return {
    content,
    totalElements: Number(body.totalElements ?? body.total_elements) || 0,
    totalPages: Number(body.totalPages ?? body.total_pages) || 0,
    size: Number(body.size) || 0,
    number: Number(body.number) || 0,
    first: Boolean(body.first),
    last: Boolean(body.last),
    empty: Boolean(body.empty),
  };
}

export async function toggleReaction(
  targetType: InteractionTargetType,
  targetId: string,
  reactionType: ReactionType,
): Promise<ReactionToggleResult> {
  const res = await apiFetch('/api/v1/interaction/reactions/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, targetId, reactionType }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `반응 처리 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const active = Boolean(row.active);
  const rt = row.reactionType ?? row.reaction_type;
  const reactionTypeOut: ReactionType | null =
    rt === 'LIKE' || rt === 'UPVOTE' || rt === 'DOWNVOTE' ? rt : null;
  return { active, reactionType: reactionTypeOut };
}

export async function getComments(
  targetType: InteractionTargetType,
  targetId: string,
  page: number,
  size: number,
): Promise<CommentPage> {
  const params = new URLSearchParams({
    targetType,
    targetId,
    page: String(Math.max(0, page)),
    size: String(Math.max(1, size)),
  });
  const res = await apiFetch(`/api/v1/interaction/comments?${params.toString()}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `댓글을 불러오지 못했습니다 (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  return parseCommentPage(body);
}

export async function createComment(
  targetType: InteractionTargetType,
  targetId: string,
  content: string,
  options?: {
    parentCommentId?: string | null;
    guestPassword?: string | null;
    authorName?: string | null;
  },
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    targetType,
    targetId,
    body: content,
    parentCommentId: options?.parentCommentId ?? null,
  };
  const gp = options?.guestPassword?.trim();
  const an = options?.authorName?.trim();
  if (gp) body.guestPassword = gp;
  if (an !== undefined && an !== '') body.authorName = an;
  const res = await apiFetch('/api/v1/interaction/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `댓글 등록 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const id = row.id != null ? String(row.id) : '';
  return { id };
}

export async function deleteComment(
  commentId: string,
  guestPassword?: string | null,
): Promise<void> {
  const res = await apiFetch(`/api/v1/interaction/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      guestPassword != null && guestPassword.trim() !== ''
        ? { guestPassword: guestPassword.trim() }
        : {},
    ),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `댓글 삭제 실패 (${res.status})`);
  }
}
