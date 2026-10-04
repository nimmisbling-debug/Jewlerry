import Link from "next/link";
import { getStoreName } from "@/lib/settings/queries";
import { StoreWordmark } from "@/components/layout/store-wordmark";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const storeName = await getStoreName();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex justify-center border-b border-border/60 py-6">
        <Link href="/" className="font-heading text-2xl font-semibold tracking-wide text-foreground">
          <StoreWordmark name={storeName} />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
