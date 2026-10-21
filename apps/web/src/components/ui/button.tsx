import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-700/30 hover:from-brand-600 hover:to-brand-700 active:scale-[.98]",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
        variant === "danger" && "text-red-600 hover:bg-red-50",
        className
      )}
      {...props}
    />
  );
}
