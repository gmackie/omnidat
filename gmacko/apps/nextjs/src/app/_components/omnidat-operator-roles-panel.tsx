"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

const ROLE_OPTIONS = [
  "admin",
  "packet-operator",
  "noc-operator",
  "bank-operator",
  "vendor-operator",
  "campsite-owner",
  "auditor",
] as const;

export function OmnidatOperatorRolesPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    ...trpc.omnidat.listOperatorRoles.queryOptions(),
    retry: false,
  });
  const meQuery = useQuery({
    ...trpc.omnidat.operatorMe.queryOptions(),
    retry: 1,
  });

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("packet-operator");
  const [message, setMessage] = useState<string | null>(null);

  // Prefill grant target with the signed-in operator id once known.
  const myUserId = meQuery.data?.userId ?? "";

  const grant = useMutation(
    trpc.omnidat.grantOperatorRole.mutationOptions({
      onSuccess: async (result) => {
        setMessage(`Granted ${result.role} to ${result.userId}`);
        setUserId("");
        await queryClient.invalidateQueries(
          trpc.omnidat.listOperatorRoles.queryFilter(),
        );
      },
      onError: (error) => {
        setMessage(error.message ?? "Grant failed");
      },
    }),
  );

  const revoke = useMutation(
    trpc.omnidat.revokeOperatorRole.mutationOptions({
      onSuccess: async (_result, variables) => {
        setMessage(`Revoked ${variables.role} from ${variables.userId}`);
        await queryClient.invalidateQueries(
          trpc.omnidat.listOperatorRoles.queryFilter(),
        );
      },
      onError: (error) => {
        setMessage(error.message ?? "Revoke failed");
      },
    }),
  );

  if (rolesQuery.isError) {
    return (
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Operator Roles</h2>
        <p className="mt-3 font-mono text-sm text-[#d9cbb0]">
          ADMIN ONLY — role.write required to list or grant roles
        </p>
      </section>
    );
  }

  const grants = rolesQuery.data?.roles ?? [];

  return (
    <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
      <h2 className="text-2xl font-bold">Operator Roles</h2>
      <p className="mt-1 text-sm text-[#c0a36e]">
        Grant capability roles after OmniAuth users first appear. Your user id:{" "}
        <span className="font-mono text-[#9ed783]">
          {myUserId || (meQuery.isLoading ? "loading…" : "(sign in)")}
        </span>
        {myUserId ? (
          <button
            type="button"
            className="ml-2 rounded border border-[#7a694f] px-2 py-0.5 text-xs"
            onClick={() => setUserId(myUserId)}
          >
            Use mine
          </button>
        ) : null}
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!userId.trim()) return;
          grant.mutate({ userId: userId.trim(), role });
        }}
      >
        <input
          className="rounded border border-[#5c4a32] bg-[#17130d] px-3 py-2 font-mono text-sm text-[#f4ead2]"
          placeholder="better-auth user id"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        />
        <select
          className="rounded border border-[#5c4a32] bg-[#17130d] px-3 py-2 text-sm text-[#f4ead2]"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as (typeof ROLE_OPTIONS)[number])
          }
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          className="rounded bg-[#d8b46f] px-4 py-2 font-semibold text-[#16140f] disabled:opacity-50"
          disabled={grant.isPending || !userId.trim()}
          type="submit"
        >
          Grant
        </button>
      </form>

      {message ? (
        <p className="mt-3 font-mono text-sm text-[#9ed783]">{message}</p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        {grants.length === 0 ? (
          <p className="font-mono text-sm text-[#d9cbb0]">
            NO ROLE ROWS — bootstrap admins still operate via OMNIDAT_BOOTSTRAP_ADMINS
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="text-left text-[#c0a36e]">
              <tr>
                <th className="border-b border-[#5c4a32] py-2">User</th>
                <th className="border-b border-[#5c4a32] py-2">Role</th>
                <th className="border-b border-[#5c4a32] py-2">Event</th>
                <th className="border-b border-[#5c4a32] py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grantRow) => (
                <tr key={`${grantRow.userId}-${grantRow.role}-${grantRow.eventId ?? ""}`}>
                  <td className="border-b border-[#33291d] py-3 font-mono">
                    {grantRow.userId}
                  </td>
                  <td className="border-b border-[#33291d] py-3">{grantRow.role}</td>
                  <td className="border-b border-[#33291d] py-3 font-mono">
                    {grantRow.eventId ?? "—"}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    <button
                      className="rounded border border-[#7a694f] px-2 py-1 text-xs"
                      type="button"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate({
                          userId: grantRow.userId,
                          role: grantRow.role as (typeof ROLE_OPTIONS)[number],
                        })
                      }
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
