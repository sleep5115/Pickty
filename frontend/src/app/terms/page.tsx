import type { Metadata } from 'next';
import { LegalMarkdownArticle } from '@/components/legal/legal-markdown-article';
import { readLegalDoc, stripInternalLegalNotes } from '@/lib/read-legal-doc';

export const metadata: Metadata = {
  title: '이용약관 — Pickty',
  description: '픽티(Pickty) 서비스 이용약관',
};

export default function TermsPage() {
  const raw = readLegalDoc('TERMS_OF_SERVICE_KO.md');
  const markdown = stripInternalLegalNotes(raw);
  return <LegalMarkdownArticle title="서비스 이용약관" markdown={markdown} />;
}
