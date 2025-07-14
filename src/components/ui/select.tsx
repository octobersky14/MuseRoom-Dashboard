import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  size?: "sm" | "default" | "lg";
  isLoading?: boolean;
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size = "default", isLoading, ...props }, ref) => {
  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    default: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base"
  };

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between rounded-md",
        "border border-gray-700/50 bg-gray-900/60 backdrop-blur-sm",
        "hover:border-purple-500/40 hover:bg-gray-800/70",
        "focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:ring-offset-2 focus:ring-offset-gray-900",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200",
        "after:absolute after:inset-0 after:rounded-md after:bg-gradient-to-r after:from-purple-500/5 after:via-transparent after:to-pink-500/5 after:opacity-0 after:transition-opacity hover:after:opacity-100",
        "before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-purple-500/3 before:via-transparent before:to-pink-500/3 before:blur-md before:opacity-0 before:transition-opacity hover:before:opacity-100",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 relative">
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin" />
        )}
        {children}
      </div>
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden",
        "rounded-md border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl",
        "shadow-lg shadow-black/30",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "after:absolute after:inset-0 after:rounded-md after:bg-gradient-to-br after:from-purple-500/10 after:via-transparent after:to-pink-500/10 after:opacity-30 after:pointer-events-none",
        "before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-br before:from-purple-500/5 before:via-transparent before:to-pink-500/5 before:blur-xl before:opacity-20 before:pointer-events-none",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollUpButton />
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "py-1.5 px-2 text-xs font-medium text-gray-400 select-none",
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2",
      "text-sm text-gray-200 outline-none transition-colors duration-200",
      "focus:bg-gradient-to-r focus:from-purple-900/40 focus:to-pink-900/40 focus:text-white",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "hover:bg-gradient-to-r hover:from-purple-900/30 hover:to-pink-900/30",
      "after:absolute after:inset-0 after:rounded-sm after:bg-gradient-to-r after:from-purple-500/10 after:via-transparent after:to-pink-500/10 after:opacity-0 after:transition-opacity hover:after:opacity-100 focus:after:opacity-100",
      "before:absolute before:inset-0 before:rounded-sm before:bg-gradient-to-r before:from-purple-500/5 before:via-transparent before:to-pink-500/5 before:blur-md before:opacity-0 before:transition-opacity hover:before:opacity-100 focus:before:opacity-100",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-purple-400" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <span className="pl-6">{children}</span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-pointer items-center justify-center py-1",
      "text-gray-400 hover:text-white transition-colors",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-pointer items-center justify-center py-1",
      "text-gray-400 hover:text-white transition-colors",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(
      "-mx-1 my-1 h-px bg-gradient-to-r from-transparent via-gray-700/70 to-transparent",
      className
    )}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
