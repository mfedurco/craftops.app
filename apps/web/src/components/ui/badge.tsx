import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
