"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnMount() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}
