import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // ── shadcn/ui デフォルト ──────────────
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:     "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link:        "text-primary underline-offset-4 hover:underline",
        // ── ブランド variant ──────────────────
        /** グラデーションプライマリ（最頻出） */
        "brand-gradient": "bg-brand-gradient text-white hover:opacity-90 active:opacity-80",
        /** ソリッドプライマリ */
        "brand":          "bg-brand text-white hover:opacity-90 active:opacity-80",
        /** ゴーストボタン（ナビ・戻るボタン） */
        "brand-ghost":    "bg-brand-bg border border-brand-border text-brand-muted hover:bg-brand-border",
        /** アウトラインボタン（サブアクション） */
        "brand-outline":  "bg-white border border-brand text-brand hover:bg-[#FFF5F5]",
        /** フッター・ダーク背景向け */
        "brand-muted":    "bg-brand-footer text-white hover:opacity-90",
      },
      size: {
        // ── shadcn/ui デフォルト ──────────────
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg:      "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon:    "size-9 rounded-md",
        // ── ブランド size ─────────────────────
        /** 丸ピル（このプロジェクトの最頻出形状） */
        pill:    "h-9 px-5 rounded-full",
        "pill-sm": "h-8 px-4 rounded-full text-xs",
        "pill-lg": "h-11 px-8 rounded-full text-base font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
