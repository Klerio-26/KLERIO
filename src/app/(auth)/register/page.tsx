import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <div>
      <p className="section-title">Gratuit, sans carte bancaire</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">On commence simplement.</h1>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        20 pages de scan offertes à vie, un coffre-fort de 10 Go et 10 explications par mois.
      </p>
      <div className="mt-7">
        <RegisterForm />
      </div>
    </div>
  );
}
