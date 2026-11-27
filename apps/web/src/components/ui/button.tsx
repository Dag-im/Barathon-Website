import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Button variants per design 6.1 (4px radius, Afacad Flux 600, token colours). */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded font-display font-semibold tracking-[0.01em] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-[#2F447D] text-white hover:bg-[#3A5188]",
        primary: "bg-[#2F447D] text-white hover:bg-[#3A5188] active:bg-[#25376A] section-navy:bg-white",
        dark: "bg-[#111827] text-white hover:bg-[#1F2937] active:bg-[#0B1220]",
        secondary: "bg-[#EEF1F8] text-[#25376A] hover:bg-[#DDE3F1] active:bg-[#BCC8E2]",
        outline: "border border-[#2F447D] bg-transparent text-[#2F447D] hover:bg-[#EEF1F8] active:bg-[#DDE3F1]",
        ghost: "bg-transparent text-[#374151] hover:bg-[#F1F3F5] hover:text-[#111827] active:bg-[#E5E7EB]",
        accent: "bg-[#843C40] text-white hover:bg-[#6D3034] active:bg-[#572628]",
        link: "h-auto gap-1 rounded-none p-0 font-sans font-medium text-[#0D5380] underline underline-offset-[3px] hover:text-[#2F447D] hover:decoration-2 active:text-[#25376A]",
        destructive: "bg-[#B91C1C] text-white hover:bg-[#991B1B] active:bg-[#7F1D1D]",
      },
      size: {
        sm: "h-9 px-3.5 text-[15px] [&_svg:not([class*='size-'])]:size-4",
        default: "h-11 px-5 text-base",
        md: "h-11 px-5 text-base",
        lg: "h-13 px-7 text-[17px]",
        icon: "size-11 px-0",
        "icon-sm": "size-9 px-0 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const classes = cn(buttonVariants({ variant, size }), "section-navy:text-[#111827]", className);
  if (asChild) {
    return <Slot.Root data-slot="button" data-variant={variant} data-size={size} className={classes} {...props} />;
  }
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {props.children}
    </button>
  );
}

export { Button, buttonVariants };
