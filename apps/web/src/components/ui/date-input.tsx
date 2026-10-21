import { cn } from "@/lib/utils";
import { controlClass } from "./input";

export function DateInput({ className, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="date" className={cn(controlClass, className)} {...p} />;
}
