import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  size?: "thin" | "default" | "thick";
  variant?: "default" | "gradient" | "glow";
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(({ 
  className, 
  orientation = "horizontal", 
  decorative = true,
  size = "default",
  variant = "default",
  ...props 
}, ref) => {
  const sizeClasses = {
    thin: orientation === "horizontal" ? "h-px" : "w-px",
    default: orientation === "horizontal" ? "h-[1px]" : "w-[1px]",
    thick: orientation === "horizontal" ? "h-[2px]" : "w-[2px]",
  };

  const variantClasses = {
    default: "bg-gray-800",
    gradient: orientation === "horizontal" 
      ? "bg-gradient-to-r from-transparent via-gray-700 to-transparent" 
      : "bg-gradient-to-b from-transparent via-gray-700 to-transparent",
    glow: orientation === "horizontal"
      ? "bg-gradient-to-r from-transparent via-purple-900/30 to-transparent after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-purple-500/10 after:to-transparent after:blur-sm"
      : "bg-gradient-to-b from-transparent via-purple-900/30 to-transparent after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-purple-500/10 after:to-transparent after:blur-sm"
  };

  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "relative shrink-0",
        orientation === "horizontal" ? "w-full" : "h-full",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});

Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
