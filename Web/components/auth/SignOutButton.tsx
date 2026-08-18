"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/** Ends the Auth.js session and returns the user to the standard sign-in page. */
export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);

    try {
      await signOut({ redirectTo: "/login" });
    } catch {
      setError("Sign out could not be completed. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex h-8 items-center rounded-[8px] border border-[var(--cg-border-strong)] bg-white px-3 text-[12px] font-semibold text-[var(--cg-text-primary)] transition-colors duration-150 hover:bg-[var(--cg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {signingOut ? "Logging out..." : "Log out"}
      </button>
      {error ? (
        <p role="alert" className="absolute right-0 top-10 w-56 text-right text-[11px] text-[var(--cg-red)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
