"use client";

import dynamic from "next/dynamic";

// Dynamically import the Map component to avoid SSR issues
const Map = dynamic(
  () => import("~/app/_components/map").then((mod) => ({ default: mod.Map })),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen bg-gray-200 animate-pulse" />
    ),
  }
);

export function DynamicMap() {
  return <Map center={[40.7128, -74.006]} />;
}
