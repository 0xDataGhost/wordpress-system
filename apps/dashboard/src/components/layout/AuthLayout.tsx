import { Outlet } from "react-router-dom";
import { Store } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** Centered layout for the auth pages (login, register, password flows). */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>

      {/* Decorative atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 end-0 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Store className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold">لوحة تحكم المتجر</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أدِر متجرك من مكان واحد بكل سهولة
            </p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
