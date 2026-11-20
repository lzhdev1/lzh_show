export interface ArticleSummary {
  slug: string;
  projectSlug: string;
  publishedAt: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface Article extends ArticleSummary {
  sections: {
    heading: string;
    paragraphs: string[];
    table?: { columns: string[]; rows: string[][] };
  }[];
}
