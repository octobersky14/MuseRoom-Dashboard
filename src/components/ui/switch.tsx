import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  isLoading?: boolean;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, isLoading, disabled, ...props }, ref) => {
  const isDisabled = isLoading || disabled;

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-pink-600",
        "data-[state=unchecked]:bg-gray-800/70 data-[state=unchecked]:hover:bg-gray-700/80",
        "after:absolute after:inset-0 after:rounded-full after:bg-gradient-to-r after:from-purple-500/10 after:via-transparent after:to-pink-500/10 after:opacity-0 after:transition-opacity data-[state=checked]:after:opacity-100",
        "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r before:from-purple-500/5 before:via-transparent before:to-pink-500/5 before:blur-xl before:opacity-0 before:transition-opacity data-[state=checked]:before:opacity-100",
        isDisabled && "pointer-events-none opacity-50",
        className
      )}
      disabled={isDisabled}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full shadow-lg",
          "bg-white transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
          "data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-purple-300 data-[state=checked]:to-pink-300",
          "ring-0 transition-colors duration-200",
          "after:absolute after:inset-0 after:rounded-full after:bg-gradient-to-br after:from-purple-200/80 after:to-pink-200/80 after:opacity-0 after:transition-opacity data-[state=checked]:after:opacity-100",
          "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-purple-300/30 before:to-pink-300/30 before:blur-sm before:opacity-0 before:transition-opacity data-[state=checked]:before:opacity-100",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.1)] data-[state=checked]:shadow-[0_0_10px_rgba(139,92,246,0.4)]"
        )}
      >
        {isLoading && (
          <Loader2 className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-600 animate-spin" />
        )}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
});

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
