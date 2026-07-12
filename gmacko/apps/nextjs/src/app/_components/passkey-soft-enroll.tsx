"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "omnidat.passkey-soft-enroll.dismissed";
const AUTHENTIK_PASSKEY_URL =
  process.env.NEXT_PUBLIC_PASSKEY_ENROLL_URL ??
  "https://auth.omnidat.cc/if/flow/default-authenticator-webauthn-setup/";

/**
 * Soft passkey enrollment nudge after OmniAuth login.
 * Authentik owns WebAuthn; we only surface a dismissible prompt so day-to-day
 * login can move from password bootstrap to passkey without hard MFA loops.
 */
export function PasskeySoftEnroll(props: {
  signedIn: boolean;
  userEmail?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!props.signedIn || typeof window === "undefined") {
      setVisible(false);
      return;
    }
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      setVisible(dismissed !== "1");
    } catch {
      setVisible(true);
    }
  }, [props.signedIn]);

  if (!props.signedIn || !visible) return null;

  return (
    <aside
      className="w-full rounded border border-[#4f6b3a] bg-[#1a2413] p-4 text-left"
      data-testid="passkey-soft-enroll"
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-[#9ed783]">
        Enroll a passkey
      </p>
      <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
        You are signed in
        {props.userEmail ? (
          <>
            {" "}
            as <span className="font-mono text-[#c0a36e]">{props.userEmail}</span>
          </>
        ) : null}
        . Add a passkey on OmniAuth so future logins skip the password path.
        Password remains available for recovery and new devices.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          className="rounded bg-[#c0a36e] px-3 py-2 text-sm font-semibold text-black"
          href={AUTHENTIK_PASSKEY_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open passkey setup
        </a>
        <button
          type="button"
          className="rounded border border-[#5c4a32] px-3 py-2 text-sm text-[#d9cbb0]"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore quota / private mode */
            }
            setVisible(false);
          }}
        >
          Dismiss for now
        </button>
      </div>
    </aside>
  );
}
