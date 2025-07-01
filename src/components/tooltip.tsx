import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import clsx from "clsx";
import { PropsWithChildren, forwardRef, useState } from "react";

export const TooltipWrap = forwardRef<
  React.ElementRef<typeof PopoverContent>,
  PropsWithChildren<{
    content: React.ReactNode;
    className?: string;
  }>
>(function PopoverWrap({ className, children, content, ...props }, ref) {
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        asChild
      >
        {children}
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          side="top"
          ref={ref}
          sideOffset={4}
          className={clsx(
            "z-50 max-w-80 overflow-hidden rounded-md bg-main-900 px-5 py-3 text-sm text-main-100 shadow-md animate-in fade-in-0 zoom-in-95 focus:outline-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
        >
          {content}
          <PopoverArrow className="fill-main-900" />
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
});
