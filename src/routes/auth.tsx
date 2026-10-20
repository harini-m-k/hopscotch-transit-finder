import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Login — SmartTransit" },
      { name: "description", content: "Sign in to manage buses, routes and bus stops." },
      { property: "og:title", content: "Admin Login — SmartTransit" },
      { property: "og:description", content: "Sign in to the transport admin dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) navigate({ to: "/admin", replace: true });
  }, [ready, user, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Signed in");
    navigate({ to: "/admin" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    setError(null);
    setInfo(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      toast.success("Account created and signed in");
      navigate({ to: "/admin" });
    } else {
      setInfo("Account created. Check your email to confirm it, then sign in.");
    }
  }

  const fields = (idPrefix: string) => (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input id={`${idPrefix}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          required
          minLength={6}
          autoComplete={idPrefix === "in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>}
      {info && <p className="rounded-lg bg-secondary p-2.5 text-sm text-secondary-foreground">{info}</p>}
    </>
  );

  return (
    <div className="mx-auto grid max-w-md px-4 py-12">
      <div className="mb-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elevated">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Admin login</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage buses, routes and bus stops.</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <Tabs defaultValue="signin" onValueChange={() => { setError(null); setInfo(null); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              {fields("in")}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <p className="flex gap-2 rounded-lg bg-secondary p-2.5 text-xs text-secondary-foreground">
                <ShieldCheck className="size-4 shrink-0" />
                The first account ever created becomes the administrator. Accounts created later can sign in but cannot edit data.
              </p>
              {fields("up")}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
