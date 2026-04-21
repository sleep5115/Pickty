'use client';

import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import { type JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Check,
  CircleX,
  ExternalLink,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Strikethrough,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageResize } from 'tiptap-extension-resize-image';

import {
  COMMUNITY_EDITOR_MAX_CHARACTERS,
  COMMUNITY_EDITOR_MAX_IMAGES,
  collectImageFilesFromClipboard,
  collectImageFilesFromDataTransfer,
  countImageResizeNodes,
} from '@/lib/community-editor-limits';
import { unwrapAnchorAroundSingleImageInHtml } from '@/lib/community-pasted-html';
import { sanitizeCommunityHtml } from '@/lib/community-html-sanitize';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { uploadPicktyImages } from '@/lib/image-upload-api';

import type { Editor, AnyExtension } from '@tiptap/core';

export type { JSONContent } from '@tiptap/core';

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith('http') ? t : `https://${t}`).toString();
  } catch {
    return null;
  }
}

async function insertImagesFromFiles(editor: Editor, files: File[], accessToken: string | null): Promise<void> {
  if (files.length === 0) return;
  const startCount = countImageResizeNodes(editor.state.doc);
  if (startCount + files.length > COMMUNITY_EDITOR_MAX_IMAGES) {
    toast.error(`이미지는 최대 ${COMMUNITY_EDITOR_MAX_IMAGES}장까지 넣을 수 있습니다.`);
    return;
  }

  let inserted = 0;
  for (const file of files) {
    const before = countImageResizeNodes(editor.state.doc);
    if (before >= COMMUNITY_EDITOR_MAX_IMAGES) {
      toast.error(`이미지는 최대 ${COMMUNITY_EDITOR_MAX_IMAGES}장까지 넣을 수 있습니다.`);
      break;
    }
    try {
      const [url] = await uploadPicktyImages([file], accessToken, {
        onImageFailure: ({ error }) => {
          console.error('[TiptapEditor] image upload', error);
        },
      });
      if (editor.isDestroyed) return;
      const displaySrc = picktyImageDisplaySrc(url);
      editor
        .chain()
        .focus()
        .insertContent({ type: 'imageResize', attrs: { src: displaySrc, width: 400 } })
        .run();
      inserted += 1;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    }
  }
  if (inserted > 0) {
    toast.success(inserted === 1 ? '이미지를 넣었습니다.' : `${inserted}장의 이미지를 넣었습니다.`);
  }
}

function createBoardExtensions(placeholder: string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class: 'text-[var(--brand-from)] underline underline-offset-2 hover:opacity-90',
        },
      },
    }),
    Placeholder.configure({ placeholder }),
    CharacterCount.configure({
      limit: COMMUNITY_EDITOR_MAX_CHARACTERS,
      mode: 'textSize',
    }),
    Youtube.configure({
      width: 640,
      height: 360,
      HTMLAttributes: {
        class: 'my-4 aspect-video w-full max-w-3xl rounded-lg border border-[var(--border-subtle)]',
      },
    }),
    ImageResize.configure({
      inline: false,
      maxWidth: 800,
    }),
  ];
}

const editorProseClass =
  'prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-li:marker:text-[var(--text-secondary)] prose-blockquote:border-[var(--border-subtle)] prose-blockquote:text-[var(--text-secondary)] min-h-[240px] px-4 py-3 focus:outline-none [&_.ProseMirror]:min-h-[220px]';

type TiptapToolbarProps = {
  editor: Editor | null;
  accessToken: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickImage: () => void;
  onImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

type InsertDialogState =
  | {
      type: 'youtube';
      value: string;
    }
  | {
      type: 'link';
      value: string;
      label: string;
    };

function TiptapToolbar({ editor, accessToken, fileInputRef, onPickImage, onImageFileChange }: TiptapToolbarProps) {
  const [insertDialog, setInsertDialog] = useState<InsertDialogState | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      strike: ed?.isActive('strike') ?? false,
      h1: ed?.isActive('heading', { level: 1 }) ?? false,
      h2: ed?.isActive('heading', { level: 2 }) ?? false,
      bulletList: ed?.isActive('bulletList') ?? false,
    }),
  });

  const btnBase =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-base)] disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/80';
  const btnOn = 'border-[var(--border-subtle)] bg-[var(--bg-base)] dark:bg-zinc-800';

  const run = (fn: () => boolean) => {
    if (!editor) return;
    fn();
  };

  const getSelectedPlainText = () => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ').trim();
  };

  const moveCursorForInsert = (preserveTextSelection: boolean) => {
    if (!editor) return;
    const { to, empty } = editor.state.selection;
    if (empty) {
      editor.chain().focus().run();
      return;
    }
    const selectedText = getSelectedPlainText();
    if (preserveTextSelection && selectedText) {
      editor.chain().focus().run();
      return;
    }
    editor.chain().focus().setTextSelection(to).run();
  };

  const insertYoutube = () => {
    if (!editor) return;
    const url = normalizeUrl(insertDialog?.type === 'youtube' ? insertDialog.value : '');
    if (!url) return;
    moveCursorForInsert(false);
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
    setInsertDialog(null);
  };

  const insertSimpleLink = (rawUrl: string, rawLabel: string) => {
    if (!editor) return;
    const u = normalizeUrl(rawUrl);
    if (!u) return;
    moveCursorForInsert(true);
    const { from, to, empty } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    const text = rawLabel.trim() || selectedText || u;
    if (!empty && !selectedText) {
      editor.chain().focus().setTextSelection(to).run();
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href: u, target: '_blank', rel: 'noopener noreferrer' } }],
      })
      .run();
  };

  return (
    <>
      <div
        className="sticky top-0 z-50 flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2 py-1.5 backdrop-blur-md"
        role="toolbar"
        aria-label="에디터 도구"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onImageFileChange}
        />

        <button
          type="button"
          className={`${btnBase} ${state?.bold ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleBold().run())}
          title="굵게"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          className={`${btnBase} ${state?.italic ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleItalic().run())}
          title="기울임"
        >
          <Italic className="size-4" />
        </button>
        <button
          type="button"
          className={`${btnBase} ${state?.strike ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleStrike().run())}
          title="취소선"
        >
          <Strikethrough className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border-subtle)]" aria-hidden />
        <button
          type="button"
          className={`${btnBase} ${state?.h1 ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleHeading({ level: 1 }).run())}
          title="제목 1"
        >
          <Heading1 className="size-4" />
        </button>
        <button
          type="button"
          className={`${btnBase} ${state?.h2 ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())}
          title="제목 2"
        >
          <Heading2 className="size-4" />
        </button>
        <button
          type="button"
          className={`${btnBase} ${state?.bulletList ? btnOn : ''}`}
          disabled={!editor}
          onClick={() => run(() => editor!.chain().focus().toggleBulletList().run())}
          title="글머리 기호"
        >
          <List className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border-subtle)]" aria-hidden />
        <button
          type="button"
          className={btnBase}
          disabled={!editor}
          onClick={onPickImage}
          title={accessToken ? '이미지 업로드(R2)' : '이미지 업로드'}
        >
          <ImagePlus className="size-4" />
        </button>
        <button
          type="button"
          className={btnBase}
          disabled={!editor}
          onClick={() => setInsertDialog({ type: 'youtube', value: '' })}
          title="유튜브"
        >
          <Video className="size-4" />
        </button>
        <button
          type="button"
          className={btnBase}
          disabled={!editor}
          onClick={() => setInsertDialog({ type: 'link', value: '', label: '' })}
          title="링크 삽입"
        >
          <Link2 className="size-4" />
        </button>
      </div>

      {insertDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-3">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {insertDialog.type === 'youtube' ? '유튜브 삽입' : '링크 삽입'}
              </p>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
                onClick={() => setInsertDialog(null)}
                aria-label="닫기"
              >
                <CircleX className="size-4" />
              </button>
            </div>

            <label className="mb-1 block text-xs text-[var(--text-secondary)]">URL</label>
            <input
              autoFocus
              value={insertDialog.value}
              onChange={(e) => setInsertDialog((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setInsertDialog(null);
                  return;
                }
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (insertDialog.type === 'youtube') insertYoutube();
                else {
                  insertSimpleLink(insertDialog.value, insertDialog.label);
                  setInsertDialog(null);
                }
              }}
              placeholder={insertDialog.type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-fuchsia-400"
            />

            {insertDialog.type === 'link' ? (
              <>
                <label className="mb-1 mt-2 block text-xs text-[var(--text-secondary)]">표시 텍스트 (선택)</label>
                <input
                  value={insertDialog.label}
                  onChange={(e) =>
                    setInsertDialog((prev) =>
                      prev?.type === 'link'
                        ? {
                            ...prev,
                            label: e.target.value,
                          }
                        : prev,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setInsertDialog(null);
                      return;
                    }
                    if (e.key !== 'Enter' || !editor) return;
                    e.preventDefault();
                    insertSimpleLink(insertDialog.value, insertDialog.label);
                    setInsertDialog(null);
                  }}
                  placeholder="비워두면 URL 표시"
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-fuchsia-400"
                />
              </>
            ) : null}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
                onClick={() => setInsertDialog(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-fuchsia-500 px-2.5 text-xs font-medium text-white hover:bg-fuchsia-400"
                onClick={() => {
                  if (insertDialog.type === 'youtube') {
                    insertYoutube();
                    return;
                  }
                  insertSimpleLink(insertDialog.value, insertDialog.label);
                  setInsertDialog(null);
                }}
              >
                {insertDialog.type === 'link' ? <ExternalLink className="size-3.5" /> : <Check className="size-3.5" />}
                삽입
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EditorStatusBar({ editor }: { editor: Editor | null }) {
  const stats = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) {
        return { chars: 0, images: 0 };
      }
      const chars = ed.storage.characterCount?.characters() ?? 0;
      const images = countImageResizeNodes(ed.state.doc);
      return { chars, images };
    },
  });

  const chars = stats?.chars ?? 0;
  const images = stats?.images ?? 0;
  const overChars = chars > COMMUNITY_EDITOR_MAX_CHARACTERS;
  const overImages = images > COMMUNITY_EDITOR_MAX_IMAGES;

  return (
    <div
      className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-secondary)]"
      aria-live="polite"
    >
      <span className={overChars ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
        글자 수: {chars} / {COMMUNITY_EDITOR_MAX_CHARACTERS}
      </span>
      <span className="mx-2 text-[var(--border-subtle)]" aria-hidden>
        |
      </span>
      <span className={overImages ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
        이미지: {images} / {COMMUNITY_EDITOR_MAX_IMAGES}
      </span>
    </div>
  );
}

export type TiptapEditorProps = {
  content?: JSONContent | null;
  /**
   * 본문 JSON 변경 시 호출. `safeHtml`은 `getHTML()` 후 `sanitizeBoardHtml` 적용 결과(읽기 전용 렌더·백업용).
   */
  onChange?: (json: JSONContent, safeHtml?: string) => void;
  accessToken: string | null;
  placeholder?: string;
  editable?: boolean;
  className?: string;
};

export function TiptapEditor({
  content,
  onChange,
  accessToken,
  placeholder = '내용을 입력하세요…',
  editable = true,
  className = '',
}: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const editorRef = useRef<Editor | null>(null);
  const accessTokenRef = useRef(accessToken);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const extensions = useMemo(() => createBoardExtensions(placeholder), [placeholder]);

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: editorProseClass,
      },
      transformPastedHTML(html: string) {
        return unwrapAnchorAroundSingleImageInHtml(html);
      },
      handlePaste(_view: unknown, event: ClipboardEvent) {
        const ed = editorRef.current;
        if (!ed || ed.isDestroyed) return false;
        const files = collectImageFilesFromClipboard(event);
        if (files.length === 0) return false;
        event.preventDefault();
        event.stopPropagation();
        void insertImagesFromFiles(ed, files, accessTokenRef.current);
        return true;
      },
      handleDrop(_view: unknown, event: DragEvent, _slice: unknown, moved: boolean) {
        if (moved) return false;
        const ed = editorRef.current;
        if (!ed || ed.isDestroyed) return false;
        const files = collectImageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        event.stopPropagation();
        void insertImagesFromFiles(ed, files, accessTokenRef.current);
        return true;
      },
    }),
    [],
  );

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ed = editorRef.current;
    if (!ed) return;
    await insertImagesFromFiles(ed, [file], accessTokenRef.current);
  }, []);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions,
      content: content ?? undefined,
      editorProps,
      onUpdate: ({ editor: ed }) => {
        const json = ed.getJSON();
        const safeHtml = sanitizeCommunityHtml(ed.getHTML());
        onChangeRef.current?.(json, safeHtml);
      },
    },
    [extensions, editable, editorProps],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || content === undefined || content === null) return;
    const cur = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(content);
    if (cur !== next) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={`flex max-h-[min(70vh,36rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm ${className}`}
    >
      <TiptapToolbar
        editor={editor}
        accessToken={accessToken}
        fileInputRef={fileInputRef}
        onPickImage={openFilePicker}
        onImageFileChange={handleImageSelected}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <EditorContent editor={editor} />
      </div>
      <EditorStatusBar editor={editor} />
    </div>
  );
}
