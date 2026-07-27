import { Popover } from "radix-ui";
import clsx from "clsx";
import {
  ComponentProps,
  ComponentRef,
  PropsWithChildren,
  Ref,
  useState,
} from "react";

/** Shared so callers driving their own Popover still look like a TooltipWrap. */
export const tooltipContentClass =
  "z-50 max-w-80 overflow-hidden rounded-md bg-main-900 px-5 py-3 text-sm text-main-100 shadow-md animate-in fade-in-0 zoom-in-95 focus:outline-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

export function TooltipWrap({
  className,
  children,
  content,
  ref,
  ...props
}: PropsWithChildren<{
  content: React.ReactNode;
  className?: string;
  side?: ComponentProps<typeof Popover.Content>["side"];
  ref?: Ref<ComponentRef<typeof Popover.Content>>;
}>) {
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        asChild
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          side={props.side || "top"}
          ref={ref}
          sideOffset={4}
          className={clsx(tooltipContentClass, className)}
          {...props}
        >
          {content}
          <Popover.Arrow className="fill-main-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
