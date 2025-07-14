import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const labelVariants = {
  sizes: {
    default: "text-sm",
    sm: "text-xs",
    lg: "text-base"
  },
  variants: {
    default: "text-gray-200 font-medium",
    muted: "text-gray-400",
    error: "text-red-500"
  }
};

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  size?: keyof typeof labelVariants.sizes;
  variant?: keyof typeof labelVariants.variants;
  optional?: boolean;
  required?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ 
  className, 
  size = "default", 
  variant = "default", 
  optional = false,
  required = false,
  children,
  ...props 
}, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "block select-none",
      labelVariants.sizes[size],
      labelVariants.variants[variant],
      "transition-colors duration-200",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  >
    {children}
    {optional && (
      <span className="ml-1 text-gray-400 text-xs font-normal">(Optional)</span>
    )}
    {required && (
      <span className="ml-1 text-red-500" aria-hidden="true">*</span>
    )}
  </LabelPrimitive.Root>
));

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
