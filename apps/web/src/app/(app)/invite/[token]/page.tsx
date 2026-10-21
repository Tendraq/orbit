"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, ErrorText } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const accept = trpc.workspace.acceptInvite.useMutation({
    onSuccess: (r) => { setDone(true); router.push(`/${r.slug}/projects`); },
  });

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="space-y-4 text-center">
        <h1 className="text-xl font-bold">You have been invited</h1>
        <p className="text-sm text-slate-600">Accept to join the organization.</p>
        <Button disabled={accept.isPending || done} onClick={() => accept.mutate({ token })}>
          {done ? "Joined. Redirecting…" : "Accept invitation"}
        </Button>
        <ErrorText error={accept.error} />
      </Card>
    </div>
  );
}
