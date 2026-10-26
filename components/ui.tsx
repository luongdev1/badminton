import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-line bg-white shadow-card ${className}`} {...props} />;
}

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-brand text-white hover:bg-brand-dark",
      secondary: "border border-line bg-white text-ink hover:bg-slate-50",
      ghost: "text-muted hover:bg-slate-100 hover:text-ink",
      danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    },
  },
  defaultVariants: { variant: "primary" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, asChild = false, ...props }, ref) => {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />;
});
Button.displayName = "Button";

export function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "gray" | "amber" | "blue" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, detail, icon, tint = "green" }: { label: string; value: string; detail: React.ReactNode; icon: React.ReactNode; tint?: "green" | "blue" | "amber" | "rose" }) {
  const tints = {
    green: "bg-emerald-50 text-brand",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tints[tint]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-xs text-muted">{detail}</p>
    </Card>
  );
}
