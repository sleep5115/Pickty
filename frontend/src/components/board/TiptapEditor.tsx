'use client';

import CharacterCount from '@tiptap/extension-character-count';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import { mergeAttributes, Node, type JSONContent } from '@tiptap/core';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AtSign,
  Bold,
  ChevronDown,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Sparkles,
  Strikethrough,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ImageResize } from 'tiptap-extension-resize-image';

import {
  BOARD_EDITOR_MAX_CHARACTERS,
  BOARD_EDITOR_MAX_IMAGES,
  collectImageFilesFromClipboard,
  collectImageFilesFromDataTransfer,
  countImageResizeNodes,
} from '@/lib/board-editor-limits';
import { unwrapAnchorAroundSingleImageInHtml } from '@/lib/board-pasted-html';
import { sanitizeBoardHtml } from '@/lib/board-html-sanitize';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { uploadPicktyImages } from '@/lib/image-upload-api';

import type { Editor, AnyExtension } from '@tiptap/core';
import type { ReactNodeViewProps } from '@tiptap/react';

export type { JSONContent } from '@tiptap/core';

const PICKTY_HOSTNAMES = new Set(['pickty.app', 'www.pickty.app', 'localhost']);

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith('http') ? t : `https://${t}`).toString();
  } catch {
    return null;
  }
}

function parsePicktyLinkMeta(url: string): {
  href: string;
  kind: 'tier-result' | 'template' | 'other';
  title: string;
} | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (!PICKTY_HOSTNAMES.has(host)) return null;
    const path = u.pathname;
    let kind: 'tier-result' | 'template' | 'other' = 'other';
    let title = '픽티 링크';
    if (path.startsWith('/tier/result/')) {
      kind = 'tier-result';
      title = '티어표';
    } else if (path.startsWith('/template/')) {
      kind = 'template';
      title = '템플릿';
    }
    return { href: u.toString(), kind, title };
  } catch {
    return null;
  }
}

function extractTweetId(raw: string): string | null {
  const t = raw.trim();
  const m =
    t.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i) ||
    t.match(/(?:twitter|x)\.com\/[^/]+\/statuses\/(\d+)/i);
  if (m?.[1]) return m[1];
  if (/^\d{5,}$/.test(t)) return t;
  return null;
}

async function insertImagesFromFiles(
  editor: Editor,
  files: File[],
  accessToken: string | null,
): Promise<void> {
  if (files.length === 0) return;
  const startCount = countImageResizeNodes(editor.state.doc);
  if (startCount + files.length > BOARD_EDITOR_MAX_IMAGES) {
    toast.error(`이미지는 최대 ${BOARD_EDITOR_MAX_IMAGES}장까지 넣을 수 있습니다.`);
    return;
  }

  let inserted = 0;
  for (const file of files) {
    const before = countImageResizeNodes(editor.state.doc);
    if (before >= BOARD_EDITOR_MAX_IMAGES) {
      toast.error(`이미지는 최대 ${BOARD_EDITOR_MAX_IMAGES}장까지 넣을 수 있습니다.`);
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
      editor.chain().focus().insertContent({ type: 'imageResize', attrs: { src: displaySrc } }).run();
      inserted += 1;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    }
  }
  if (inserted > 0) {
    toast.success(inserted === 1 ? '이미지를 넣었습니다.' : `${inserted}장의 이미지를 넣었습니다.`);
  }
}

function PicktyLinkCardView(props: ReactNodeViewProps) {
  const { node } = props;
  const href = node.attrs.href as string;
  const title = node.attrs.title as string;
  const imageUrl = node.attrs.imageUrl as string | null;
  const kind = node.attrs.kind as string;

  return (
    <NodeViewWrapper
      as="div"
      className="not-prose my-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 shadow-sm"
      data-drag-handle=""
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 no-underline hover:opacity-95"
      >
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface)]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- OG 썸네일 URL(외부/R2)
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-center text-[10px] leading-tight text-[var(--text-secondary)]">
              OG
              <br />
              미리보기
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Pickty · {kind}
          </div>
          <div className="mt-1 line-clamp-2 font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">{href}</div>
          <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
            제목·썸네일은 이후 OG/API 연동으로 채울 수 있습니다.
          </div>
        </div>
      </a>
    </NodeViewWrapper>
  );
}

function TwitterEmbedView(props: ReactNodeViewProps) {
  const tweetId = props.node.attrs.tweetId as string;
  const src = `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(tweetId)}`;

  return (
    <NodeViewWrapper as="div" className="not-prose my-4" data-drag-handle="">
      <iframe
        title={`X 트윗 ${tweetId}`}
        src={src}
        className="h-[480px] w-full max-w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </NodeViewWrapper>
  );
}

const PicktyLinkCard = Node.create({
  name: 'picktyLinkCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      href: { default: '' },
      title: { default: '픽티 링크' },
      imageUrl: { default: null },
      kind: { default: 'other' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-pickty-link-card]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            href: el.getAttribute('data-href') ?? '',
            title: el.getAttribute('data-title') ?? '픽티 링크',
            imageUrl: el.getAttribute('data-image') || null,
            kind: el.getAttribute('data-kind') ?? 'other',
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-pickty-link-card': '',
        'data-href': node.attrs.href,
        'data-title': node.attrs.title,
        'data-image': node.attrs.imageUrl ?? '',
        'data-kind': node.attrs.kind,
        class: 'pickty-link-card-placeholder',
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PicktyLinkCardView);
  },
});

const TwitterEmbed = Node.create({
  name: 'twitterEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      tweetId: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-twitter-embed]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const id = el.getAttribute('data-tweet-id');
          return id ? { tweetId: id } : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'div',
      {
        'data-twitter-embed': '',
        'data-tweet-id': node.attrs.tweetId,
        class: 'twitter-embed-placeholder',
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TwitterEmbedView);
  },
});

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
      limit: BOARD_EDITOR_MAX_CHARACTERS,
      mode: 'textSize',
    }),
    Youtube.configure({
      width: 640,
      height: 360,
      HTMLAttributes: {
        class: 'my-4 aspect-video w-full max-w-full rounded-lg border border-[var(--border-subtle)]',
      },
    }),
    ImageResize.configure({
      inline: false,
      maxWidth: 800,
    }),
    Details.configure({
      HTMLAttributes: {
        class: 'my-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2',
      },
    }),
    DetailsSummary.configure({
      HTMLAttributes: {
        class:
          'cursor-pointer select-none list-none font-medium text-[var(--text-primary)] [&::-webkit-details-marker]:hidden',
      },
    }),
    DetailsContent.configure({
      HTMLAttributes: {
        class: 'mt-2 border-t border-[var(--border-subtle)] pt-2 text-[var(--text-primary)]',
      },
    }),
    PicktyLinkCard,
    TwitterEmbed,
  ];
}

const editorProseClass =
  'prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-li:marker:text-[var(--text-secondary)] prose-blockquote:border-[var(--border-subtle)] prose-blockquote:text-[var(--text-secondary)] min-h-[240px] px-4 py-3 focus:outline-none [&_.ProseMirror]:min-h-[220px] [&_details]:prose-p:my-1';

type TiptapToolbarProps = {
  editor: Editor | null;
  accessToken: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickImage: () => void;
  onImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function TiptapToolbar({
  editor,
  accessToken,
  fileInputRef,
  onPickImage,
  onImageFileChange,
}: TiptapToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      strike: ed?.isActive('strike') ?? false,
      h1: ed?.isActive('heading', { level: 1 }) ?? false,
      h2: ed?.isActive('heading', { level: 2 }) ?? false,
      bulletList: ed?.isActive('bulletList') ?? false,
      details: ed?.isActive('details') ?? false,
    }),
  });

  const btnBase =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-base)] disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/80';
  const btnOn = 'border-[var(--border-subtle)] bg-[var(--bg-base)] dark:bg-zinc-800';

  const run = (fn: () => boolean) => {
    if (!editor) return;
    fn();
  };

  const insertYoutube = () => {
    if (!editor) return;
    const raw = window.prompt('유튜브 URL을 입력하세요');
    const url = normalizeUrl(raw ?? '');
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const insertTwitter = () => {
    if (!editor) return;
    const raw = window.prompt('트윗 URL 또는 트윗 ID');
    const id = raw ? extractTweetId(raw) : null;
    if (!id) {
      toast.error('트윗 URL 또는 숫자 ID를 인식할 수 없습니다.');
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({ type: 'twitterEmbed', attrs: { tweetId: id } })
      .run();
  };

  const insertPicktyCard = () => {
    if (!editor) return;
    const raw = window.prompt('pickty.app 링크를 입력하세요');
    const url = normalizeUrl(raw ?? '');
    if (!url) {
      toast.error('URL이 올바르지 않습니다.');
      return;
    }
    const meta = parsePicktyLinkMeta(url);
    if (!meta) {
      toast.error('pickty.app 도메인 링크만 카드로 넣을 수 있습니다.');
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'picktyLinkCard',
        attrs: {
          href: meta.href,
          title: meta.title,
          imageUrl: null,
          kind: meta.kind,
        },
      })
      .run();
  };

  const insertSpoiler = () => {
    if (!editor) return;
    const ok = editor.chain().focus().setDetails().run();
    if (!ok) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'details',
          content: [
            {
              type: 'detailsSummary',
              content: [{ type: 'text', text: '스포일러 · 접은 글 (제목 수정)' }],
            },
            { type: 'detailsContent', content: [{ type: 'paragraph' }] },
          ],
        })
        .run();
    }
  };

  return (
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
      <button type="button" className={btnBase} disabled={!editor} onClick={insertYoutube} title="유튜브">
        <Video className="size-4" />
      </button>
      <button type="button" className={btnBase} disabled={!editor} onClick={insertTwitter} title="X(트위터)">
        <AtSign className="size-4" />
      </button>
      <button type="button" className={btnBase} disabled={!editor} onClick={insertPicktyCard} title="픽티 링크 카드">
        <Sparkles className="size-4" />
      </button>
      <button
        type="button"
        className={`${btnBase} ${state?.details ? btnOn : ''}`}
        disabled={!editor}
        onClick={insertSpoiler}
        title="접은 글 (스포일러)"
      >
        <ChevronDown className="size-4" />
      </button>
      <button
        type="button"
        className={btnBase}
        disabled={!editor}
        onClick={() => {
          if (!editor) return;
          const url = window.prompt('링크 URL');
          const label = window.prompt('표시 텍스트(비우면 URL)');
          const u = normalizeUrl(url ?? '');
          if (!u) return;
          const text = (label ?? '').trim() || u;
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text,
                  marks: [{ type: 'link', attrs: { href: u, target: '_blank', rel: 'noopener noreferrer' } }],
                },
              ],
            })
            .run();
        }}
        title="링크 삽입"
      >
        <Link2 className="size-4" />
      </button>
    </div>
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
  const overChars = chars > BOARD_EDITOR_MAX_CHARACTERS;
  const overImages = images > BOARD_EDITOR_MAX_IMAGES;

  return (
    <div
      className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-secondary)]"
      aria-live="polite"
    >
      <span className={overChars ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
        글자 수: {chars} / {BOARD_EDITOR_MAX_CHARACTERS}
      </span>
      <span className="mx-2 text-[var(--border-subtle)]" aria-hidden>
        |
      </span>
      <span className={overImages ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
        이미지: {images} / {BOARD_EDITOR_MAX_IMAGES}
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
        const safeHtml = sanitizeBoardHtml(ed.getHTML());
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
