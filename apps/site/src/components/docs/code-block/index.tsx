import { Check, Copy } from "lucide-react";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface CodeBlockProps extends ComponentProps<"pre"> {
  /** Injected by rehype-pretty-code from the code-fence language. */
  "data-language"?: string;
}

/**
 * MDX `<pre>` replacement: language label plus copy button around the
 * rehype-pretty-code output. Shiki dual-theme colors are applied via CSS
 * variables in `styles/docs.css`.
 */
export function CodeBlock({ children, ...props }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const language = props["data-language"] ?? "";

  async function handleCopy(): Promise<void> {
    const text = preRef.current?.querySelector("code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (permissions/iframe); ignore.
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-border border-b bg-muted/50 px-3.5 py-1.5">
        <span className="font-mono text-muted-foreground text-xs">
          {language}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={t(copied ? "docs.code.copied" : "docs.code.copy")}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted-foreground text-xs transition hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {t(copied ? "docs.code.copied" : "docs.code.copy")}
        </button>
      </div>
      <pre
        ref={preRef}
        {...props}
        className="overflow-x-auto p-4 font-mono text-[13px] leading-6"
      >
        {children}
      </pre>
    </div>
  );
}
