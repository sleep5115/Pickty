import type { Metadata } from 'next';
import { LegalMarkdownArticle } from '@/components/legal/legal-markdown-article';
import { readLegalDoc, stripInternalLegalNotes } from '@/lib/read-legal-doc';

export const metadata: Metadata = {
  title: '개인정보처리방침 — Pickty',
  description: '픽티(Pickty) 개인정보처리방침',
};

export default function PrivacyPage() {
  const raw = readLegalDoc('PRIVACY_POLICY_KO.md');
  const markdown = stripInternalLegalNotes(raw);
  return <LegalMarkdownArticle title="개인정보처리방침" markdown={markdown} />;
}
