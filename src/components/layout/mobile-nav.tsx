"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { StoreWordmark } from "@/components/layout/store-wordmark";

export function MobileNav({
  navLinks,
  accountHref,
  accountLabel,
  storeName,
}: {
  navLinks: { href: string; label: string }[];
  accountHref: string;
  accountLabel: string;
  storeName: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">
            <StoreWordmark name={storeName} />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
          {navLinks.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link
                href={link.href as Route}
                className="rounded-md px-3 py-2.5 text-base text-foreground hover:bg-accent"
              >
                {link.label}
              </Link>
            </SheetClose>
          ))}
          <div className="my-2 border-t border-border" />
          <SheetClose asChild>
            <Link
              href={accountHref as Route}
              className="rounded-md px-3 py-2.5 text-base text-foreground hover:bg-accent"
            >
              {accountLabel}
            </Link>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
