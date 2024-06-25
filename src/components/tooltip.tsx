"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  TooltipArrow,
  TooltipPortal,
} from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { PropsWithChildren, forwardRef } from "react";

export const TooltipWrap = forwardRef<
  React.ElementRef<typeof TooltipContent>,
  PropsWithChildren<{
    content: React.ReactNode;
    className?: string;
  }>
>(function TooltipWrap({ className, children, content, ...props }, ref) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            ref={ref}
            sideOffset={4}
            className={clsx(
              "z-50 overflow-hidden rounded-md bg-main-900 px-3 py-1.5 text-main-100 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              className,
            )}
            {...props}
          >
            {content}
            <TooltipArrow className="fill-main-900" />
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
});
