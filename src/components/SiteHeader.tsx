import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bus, LogIn, LogOut, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/search", label: "Search Buses" },
  { to: "/routes", label: "Routes" },
  { to: "/map", label: "Live Map" },
  { to: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.removeQueries({ queryKey: ["is-admin"] });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = (onClick?: () => void) =>
    NAV.map((n) => (
      <Link
        key={n.to}
        to={n.to}
        onClick={onClick}
        activeOptions={{ exact: n.to === "/" }}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
        activeProps={{ className: "bg-secondary text-secondary-foreground" }}
      >
        {n.label}
      </Link>
    ));

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elevated">
            <Bus className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold text-foreground">SmartTransit</span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              Route Optimization System
            </span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">{links()}</nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground md:flex">
                <ShieldCheck className="size-4 text-primary" />
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut /> Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">
                <LogIn /> Admin login
              </Link>
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="font-display">Menu</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1">{links(() => setOpen(false))}</nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
