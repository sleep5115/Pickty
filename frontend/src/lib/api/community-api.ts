import { apiFetch } from '@/lib/api-fetch';
import { parseCommentPage, type CommentPage } from '@/lib/api/interaction-api';

export type CommunityPostSummary = {
  id: string;
  title: string;
  viewCount: number;
  createdAt: string;
  authorUserId: number | null;
  authorNickname: string;
  authorIpPrefix: string | null;
};

export type CommunityPostDetail = {
  id: string;
  title: string;
  contentHtml: string;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  authorUserId: number | null;
  authorNickname: string;
  authorIpPrefix: string | null;
  authorAvatarUrl: string | null;
  /** 상세 조회 시 첫 페이지(백엔드 기본 30건) */
  comments: CommentPage;
};

export type CommunityPostPage = {
  content: CommunityPostSummary[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseAuthorId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSummary(row: Record<string, unknown>): CommunityPostSummary {
  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    viewCount: toNum(row.viewCount ?? row.view_count),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.created_at ?? ''),
    authorUserId: parseAuthorId(row.authorUserId ?? row.author_user_id),
    authorNickname:
      typeof row.authorNickname === 'string'
        ? row.authorNickname
        : typeof row.author_nickname === 'string'
          ? row.author_nickname
          : '익명',
    authorIpPrefix:
      typeof row.authorIpPrefix === 'string'
        ? row.authorIpPrefix
        : typeof row.author_ip_prefix === 'string'
          ? row.author_ip_prefix
          : null,
  };
}

function parseDetail(row: Record<string, unknown>): CommunityPostDetail {
  const rawComments = row.comments;
  const comments =
    rawComments != null && typeof rawComments === 'object'
      ? parseCommentPage(rawComments as Record<string, unknown>)
      : {
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 0,
          number: 0,
          first: true,
          last: true,
          empty: true,
        };

  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    contentHtml: typeof row.contentHtml === 'string' ? row.contentHtml : String(row.content_html ?? ''),
    viewCount: toNum(row.viewCount ?? row.view_count),
    commentCount: toNum(row.commentCount ?? row.comment_count),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.created_at ?? ''),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : String(row.updated_at ?? ''),
    authorUserId: parseAuthorId(row.authorUserId ?? row.author_user_id),
    authorNickname:
      typeof row.authorNickname === 'string'
        ? row.authorNickname
        : typeof row.author_nickname === 'string'
          ? row.author_nickname
          : '익명',
    authorIpPrefix:
      typeof row.authorIpPrefix === 'string'
        ? row.authorIpPrefix
        : typeof row.author_ip_prefix === 'string'
          ? row.author_ip_prefix
          : null,
    authorAvatarUrl:
      typeof row.authorAvatarUrl === 'string'
        ? row.authorAvatarUrl
        : typeof row.author_avatar_url === 'string'
          ? row.author_avatar_url
          : null,
    comments,
  };
}

export async function createCommunityPost(input: {
  title: string;
  contentHtml: string;
  guestNickname?: string | null;
  guestPassword?: string | null;
}): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    title: input.title,
    contentHtml: input.contentHtml,
  };
  const nick = input.guestNickname?.trim();
  const pwd = input.guestPassword?.trim();
  if (nick) payload.guestNickname = nick;
  if (pwd) payload.guestPassword = pwd;

  const res = await apiFetch('/api/v1/community/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `게시글 등록 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  return { id: String(row.id ?? '') };
}

export async function listCommunityPosts(page = 0, size = 20): Promise<CommunityPostPage> {
  const params = new URLSearchParams({
    page: String(Math.max(0, page)),
    size: String(Math.max(1, size)),
  });
  const res = await apiFetch(`/api/v1/community/posts?${params.toString()}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `게시글 목록 조회 실패 (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const rows = Array.isArray(body.content) ? body.content : [];
  return {
    content: rows
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
      .map((x) => parseSummary(x)),
    totalElements: toNum(body.totalElements ?? body.total_elements),
    totalPages: toNum(body.totalPages ?? body.total_pages),
    size: toNum(body.size),
    number: toNum(body.number),
    first: Boolean(body.first),
    last: Boolean(body.last),
    empty: Boolean(body.empty),
  };
}

export async function getCommunityPost(id: string): Promise<CommunityPostDetail> {
  const res = await apiFetch(`/api/v1/community/posts/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `게시글 조회 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  return parseDetail(row);
}

export async function updateCommunityPost(
  id: string,
  input: { title: string; contentHtml: string; guestPassword?: string | null },
): Promise<CommunityPostDetail> {
  const payload: Record<string, unknown> = {
    title: input.title,
    contentHtml: input.contentHtml,
  };
  const pwd = input.guestPassword?.trim();
  if (pwd) payload.guestPassword = pwd;
  const res = await apiFetch(`/api/v1/community/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `게시글 수정 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  return parseDetail(row);
}

export async function deleteCommunityPost(id: string, guestPassword?: string | null): Promise<void> {
  const body =
    guestPassword != null && guestPassword.trim() !== ''
      ? JSON.stringify({ guestPassword: guestPassword.trim() })
      : JSON.stringify({});
  const res = await apiFetch(`/api/v1/community/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `게시글 삭제 실패 (${res.status})`);
  }
}
