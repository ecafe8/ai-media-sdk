import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

interface PageContainerProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Site-wide content container and the single source of truth for page
 * width (max-w-7xl / 1280px) and horizontal gutter. Full-bleed bars
 * (header/footer) render a PageContainer inside without their own
 * horizontal padding; page sections use it directly, so header,
 * content, and footer edges always align.
 */
export function PageContainer({ className, children }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
    >
      {children}
    </div>
  );
}
