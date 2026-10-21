import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { TRPCProvider } from "@/lib/trpc-provider";

// The frame around every logged-in page: sidebar + top bar
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <CommandPalette />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="animate-fade-up mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </TRPCProvider>
  );
}
