import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const skeletonVariants = cva(
  "animate-pulse rounded-md bg-muted",
  {
    variants: {
      variant: {
        default: "bg-gray-200 dark:bg-gray-700",
        card: "bg-gray-100 dark:bg-gray-800",
      },
      size: {
        default: "",
        sm: "h-4",
        md: "h-6",
        lg: "h-8",
        icon: "h-10 w-10 rounded-full",
        avatar: "h-12 w-12 rounded-full",
        button: "h-10",
        card: "h-48",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  className?: string;
  /**
   * Optional width, can be any valid CSS width value
   */
  width?: string | number;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, size, width, ...props }, ref) => {
    const style = width
      ? { width: typeof width === "number" ? `${width}px` : width }
      : undefined;

    return (
      <div
        className={cn(skeletonVariants({ variant, size, className }))}
        ref={ref}
        style={style}
        aria-hidden="true"
        aria-label="Loading"
        role="status"
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

export { Skeleton, skeletonVariants };
