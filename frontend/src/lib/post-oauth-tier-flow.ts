'use client';

import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { resolvePostLoginRoute } from '@/lib/post-login-route';
import { createTemplate, createTierResult } from '@/lib/tier-api';
import { buildTierSnapshot, collectDistinctItems } from '@/lib/tier-snapshot';
import { useTierStore } from '@/lib/store/tier-store';
import { TIER_AUTOSAVE_THUMB_SESSION_KEY } from '@/lib/tier-autosave-thumbnail';

export type MyAccountStatus = 'ACTIVE' | 'PENDING' | 'UNKNOWN';

export async function fetchMyAccountStatus(accessToken: string): Promise<MyAccountStatus> {
  const res = await apiFetch('/api/v1/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return 'UNKNOWN';
  const me = (await res.json()) as { accountStatus?: string };
  if (me.accountStatus === 'PENDING') return 'PENDING';
  if (me.accountStatus === 'ACTIVE') return 'ACTIVE';
  return 'UNKNOWN';
}

export type TierAutoSaveRunResult =
  | { ok: true; resultId: string }
  | { ok: false; reason: 'no_intent' | 'error'; message?: string };

/** 온보딩 완료 직후 등 — intent 있을 때만 서버 저장 */
export async function runPersistedTierAutoSave(accessToken: string): Promise<TierAutoSaveRunResult> {
  await useTierStore.persist.rehydrate();
  const state = useTierStore.getState();
  if (!state.tierAutoSaveIntent) {
    return { ok: false, reason: 'no_intent' };
  }

  const listTitle = (state.autoSaveListTitle && state.autoSaveListTitle.trim()) || '내 티어표';
  const listDescription =
    state.autoSaveListDescription && state.autoSaveListDescription.trim()
      ? state.autoSaveListDescription.trim()
      : null;

  let tid = state.templateId;
  const { tiers, pool } = state;

  const thumbDataUrl =
    typeof window !== 'undefined' ? sessionStorage.getItem(TIER_AUTOSAVE_THUMB_SESSION_KEY) : null;

  try {
    if (!tid) {
      const items = collectDistinctItems(tiers, pool);
      if (items.length === 0) {
        return { ok: false, reason: 'error', message: '저장할 티어 항목이 없습니다.' };
      }
      const created = await createTemplate({ title: listTitle, items: { items } }, accessToken);
      tid = created.id;
      useTierStore.getState().setTemplateId(tid);
    }

    let thumbnailUrl: string | null = null;
    if (thumbDataUrl) {
      try {
        const imgRes = await fetch(thumbDataUrl);
        const blob = await imgRes.blob();
        const file = new File([blob], 'tier-result.png', { type: 'image/png' });
        const uploaded = await uploadPicktyImages([file], accessToken);
        thumbnailUrl = uploaded[0] ?? null;
      } catch {
        thumbnailUrl = null;
      }
    }

    const snapshot = buildTierSnapshot(tiers, pool);
    const result = await createTierResult(
      {
        templateId: tid,
        snapshotData: snapshot,
        listTitle,
        listDescription,
        isPublic: false,
        thumbnailUrl,
      },
      accessToken,
    );

    useTierStore.getState().clearTierAutoSaveIntent();
    return { ok: true, resultId: result.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : '저장에 실패했습니다.';
    return { ok: false, reason: 'error', message };
  } finally {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TIER_AUTOSAVE_THUMB_SESSION_KEY);
    }
  }
}

export type PostOAuthTierNav =
  | { kind: 'tier_result'; resultId: string }
  | { kind: 'signup_profile' }
  | { kind: 'default'; path: string; toastMessage?: string };

/**
 * OAuth 직후: auto_save intent + ACTIVE면 즉시 결과 저장, PENDING이면 온보딩만.
 * intent 없으면 기존 `resolvePostLoginRoute`와 동일.
 */
export async function resolvePostOAuthTierFlow(
  accessToken: string,
  returnTo: string | null,
): Promise<PostOAuthTierNav> {
  await useTierStore.persist.rehydrate();

  if (!useTierStore.getState().tierAutoSaveIntent) {
    const path = await resolvePostLoginRoute(returnTo);
    return { kind: 'default', path };
  }

  const status = await fetchMyAccountStatus(accessToken);
  if (status === 'PENDING') {
    return { kind: 'signup_profile' };
  }

  if (status !== 'ACTIVE') {
    const path = await resolvePostLoginRoute(returnTo);
    return { kind: 'default', path };
  }

  const save = await runPersistedTierAutoSave(accessToken);
  if (save.ok) {
    return { kind: 'tier_result', resultId: save.resultId };
  }

  useTierStore.getState().clearTierAutoSaveIntent();
  const path = await resolvePostLoginRoute(returnTo);
  const toastMessage = save.reason === 'error' ? save.message : undefined;
  return { kind: 'default', path, toastMessage };
}
