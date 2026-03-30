import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = href?.startsWith('http://') || href?.startsWith('https://');
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
};

type Props = {
  title: string;
  markdown: string;
};

export function LegalMarkdownArticle({ title, markdown }: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto py-10 pb-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mb-8">
        {title}
      </h1>
      <article
        className={[
          'prose prose-slate max-w-none dark:prose-invert',
          'prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-a:text-violet-600 prose-a:underline prose-a:decoration-violet-500/40 prose-a:underline-offset-2',
          'dark:prose-a:text-violet-400 dark:prose-a:decoration-violet-400/40',
          'prose-strong:text-slate-900 dark:prose-strong:text-zinc-100',
          'prose-table:text-sm prose-th:border prose-th:border-slate-200 prose-th:px-3 prose-th:py-2',
          'dark:prose-th:border-zinc-700',
          'prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2',
          'dark:prose-td:border-zinc-700',
          'prose-hr:border-slate-200 dark:prose-hr:border-zinc-700',
        ].join(' ')}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {markdown}
        </ReactMarkdown>
      </article>
      <p className="mt-12 text-sm text-slate-500 dark:text-zinc-500">
        <Link
          href="/"
          className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2"
        >
          ← 홈으로
        </Link>
      </p>
    </div>
  );
}
