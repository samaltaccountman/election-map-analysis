import "server-only";
import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { HydrateClient, api } from "~/trpc/server";
import { DynamicMap } from "~/app/_components/dynamic-map";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="h-screen w-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <DynamicMap />
      </main>
    </HydrateClient>
  );
}
