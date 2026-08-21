import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

interface PageContainerProps {
  readonly className?: string;
  readonly children: ReactNode;
  readonly wide?: boolean;
}

/**
 * Site-wide content container and the single source of truth for page
 * width (max-w-7xl / 1280px) and horizontal gutter. Full-bleed bars
 * (header/footer) render a PageContainer inside without their own
 * horizontal padding; page sections use it directly, so header,
 * content, and footer edges always align.
 */
export function PageContainer({
  className,
  children,
  wide = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        wide ? "max-w-none" : "max-w-7xl",
        className
      )}
    >
      {children}
    </div>
  );
}
