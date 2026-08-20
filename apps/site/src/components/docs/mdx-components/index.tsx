import { Alert } from "@workspace/ui/components/shadcn/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/shadcn/table";
import { ExternalLink } from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createContext, useContext } from "react";
import { Link } from "react-router-dom";

import { CodeBlock } from "@/components/docs/code-block";
import type { MdxComponents } from "@/lib/docs/mdx-types";
import type { SiteLang } from "@/lib/locale";

/**
 * MDX element mapping for docs articles. Internal links are written
 * language-neutral in content (`/docs/<slug>`) and rewritten here with the
 * active language segment; external links open in a new tab.
 */

const DocsLangContext = createContext<SiteLang>("en");

export function DocsLangProvider({
  lang,
  children,
}: {
  lang: SiteLang;
  children: ReactNode;
}) {
  return (
    <DocsLangContext.Provider value={lang}>{children}</DocsLangContext.Provider>
  );
}

export function useDocsLang(): SiteLang {
  return useContext(DocsLangContext);
}

function DocsAnchor({
  href = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const lang = useDocsLang();

  if (href.startsWith("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link to={`/${lang}${href}`} className={props.className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
      <ExternalLink
        className="ml-0.5 inline size-3 align-baseline"
        aria-hidden
      />
    </a>
  );
}

function DocsBlockquote({ children }: { children?: ReactNode }) {
  return <Alert className="my-4 not-italic">{children}</Alert>;
}

export const MDX_COMPONENTS: MdxComponents = {
  a: DocsAnchor,
  pre: CodeBlock,
  blockquote: DocsBlockquote,
  table: Table,
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
};
