import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Call after any successful database change so every page shows fresh data. */
export function useRefreshNetwork() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["network"] });
}

/** Turn database error messages into friendlier text. */
export function friendlyError(message: string) {
  if (message.includes("duplicate key")) return "That value already exists. Please use a unique name/number.";
  if (message.includes("row-level security")) return "Your account is not allowed to change this data.";
  if (message.includes("violates check constraint")) return "One of the values is out of the allowed range.";
  return message;
}

export function ConfirmDelete({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<{ error: { message: string } | null }>;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const refresh = useRefreshNetwork();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={title}>
          <Trash2 className="text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { error } = await onConfirm();
              setBusy(false);
              if (error) {
                toast.error(friendlyError(error.message));
                return;
              }
              toast.success("Deleted from the database");
              setOpen(false);
              refresh();
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">{message}</p>;
}
