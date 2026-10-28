import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { allowSimulation } from "@/lib/env";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Se connecter" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (session) redirect("/app");
  const { next } = await searchParams;

  return (
    <div>
      <p className="section-title">Bon retour</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Ravi de vous revoir.</h1>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        Connectez-vous pour retrouver votre coffre-fort et vos rappels.
      </p>
      <div className="mt-7">
        <LoginForm next={next} showDemo={allowSimulation} />
      </div>
    </div>
  );
}
