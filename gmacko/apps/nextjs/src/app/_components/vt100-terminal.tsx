"use client";

import type { Vt100Cell, Vt100Screen } from "@omnidat/operator-core/vt100";
import { Vt100Terminal, omnidatPrompt } from "@omnidat/operator-core/vt100";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTRPC } from "~/trpc/react";

// Immersive VT100 operator terminal. The shared @omnidat/operator-core/vt100
// emulator (the same module the server renders through) owns an 80x24 screen
// buffer; this component only feeds it keystrokes and command transcripts and
// paints the resulting cells with authentic P1-phosphor CRT styling. Commands
// run server-side through omnidat.xotCommand (persisted + journaled); DIR/HELP
// resolve locally so the terminal never dead-ends when the directory is warm.

const LOCAL_HELP =
  "VERBS: DIR [NS], LOOKUP <X121>, CALL <X121> [VERB], STATUS <X121>, PAD <X121>, BILL <ACCT>, HELP, CLEAR";

/** Group a row's cells into runs of identical attributes for light DOM. */
interface CellRun {
  text: string;
  attr: Vt100Cell["attr"];
  start: number;
}
function runsForRow(cells: Vt100Cell[]): CellRun[] {
  const runs: CellRun[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    const last = runs[runs.length - 1];
    if (last && sameAttr(last.attr, cell.attr)) {
      last.text += cell.char;
    } else {
      runs.push({ text: cell.char, attr: cell.attr, start: i });
    }
  }
  return runs;
}
function sameAttr(a: Vt100Cell["attr"], b: Vt100Cell["attr"]): boolean {
  return (
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.underline === b.underline &&
    a.blink === b.blink &&
    a.reverse === b.reverse
  );
}

export function Vt100OperatorTerminal({ x121 = "311088000001" }: { x121?: string }) {
  const trpc = useTRPC();
  const termRef = useRef<Vt100Terminal | null>(null);
  if (termRef.current === null) termRef.current = new Vt100Terminal();
  const term = termRef.current;

  const [screen, setScreen] = useState<Vt100Screen>(() => term.screen());
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const bootedRef = useRef(false);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const banner = useQuery(trpc.omnidat.terminalBanner.queryOptions({ x121 }));
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const directory = services.data?.services ?? [];
  const prompt = banner.data?.prompt ?? omnidatPrompt(x121);

  const sync = useCallback(() => setScreen(term.screen()), [term]);
  const writeln = useCallback(
    (text = "") => {
      term.write(`${text.replace(/\r?\n/gu, "\r\n")}\r\n`);
    },
    [term],
  );

  // Boot: paint the login banner once it arrives, then the first prompt.
  useEffect(() => {
    if (bootedRef.current || !banner.data) return;
    bootedRef.current = true;
    term.reset();
    term.write(banner.data.banner.replace(/\r?\n/gu, "\r\n"));
    term.write(`\r\n${banner.data.prompt}`);
    sync();
  }, [banner.data, term, sync]);

  const xot = useMutation(
    trpc.omnidat.xotCommand.mutationOptions({
      onSuccess: (result) => {
        writeln();
        writeln(result.transcript);
      },
      onError: (error) => {
        writeln();
        writeln(
          /role required/i.test(error.message ?? "")
            ? "CLR NA C:11 D:70 — OPERATOR ROLE REQUIRED"
            : `CLR DER C:9 D:0 — ${(error.message ?? "SESSION FAILED").toUpperCase()}`,
        );
      },
      onSettled: () => {
        term.write(`\r\n${prompt}`);
        setBusy(false);
        sync();
      },
    }),
  );

  const runLocal = useCallback(
    (verb: string, args: string[]): boolean => {
      if (verb === "HELP" || verb === "?") {
        writeln();
        writeln(LOCAL_HELP);
        return true;
      }
      if (verb === "CLEAR" || verb === "CLR" || verb === "BYE") {
        term.reset();
        if (banner.data) {
          term.write(banner.data.banner.replace(/\r?\n/gu, "\r\n"));
        }
        return true;
      }
      if (verb === "DIR" && directory.length > 0) {
        const ns = args[0]?.toUpperCase();
        const rows = directory
          .filter((s) => !ns || s.category.toUpperCase() === ns)
          .map(
            (s) =>
              `${s.x121}  ${s.name.toUpperCase().padEnd(28, " ").slice(0, 28)}  ${s.status.toUpperCase()}`,
          );
        writeln();
        writeln(rows.length ? rows.join("\n") : "(EMPTY DIRECTORY)");
        return true;
      }
      return false;
    },
    [directory, term, writeln, banner.data],
  );

  const submit = useCallback(() => {
    const raw = input.trim();
    // Echo the typed command into the emulator at the live prompt.
    term.write(input);
    setInput("");
    if (!raw) {
      term.write(`\r\n${prompt}`);
      sync();
      return;
    }
    setHistory((h) => [raw, ...h].slice(0, 100));
    setHistIdx(-1);
    const [verbRaw = "", ...args] = raw.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    if (runLocal(verb, args)) {
      term.write(`\r\n${prompt}`);
      sync();
      return;
    }

    setBusy(true);
    xot.mutate({ sourceX121: x121, command: raw });
    sync();
  }, [input, prompt, runLocal, sync, term, x121, xot]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy) submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = Math.min(history.length - 1, idx + 1);
        if (history[next] !== undefined) setInput(history[next]);
        return next;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = idx - 1;
        setInput(next < 0 ? "" : (history[next] ?? ""));
        return next < 0 ? -1 : next;
      });
    }
  }

  // The live input row is drawn as the emulator's current cursor line plus the
  // in-flight `input`; the block cursor sits after it.
  const rows = useMemo(() => screen.rows, [screen]);

  return (
    <div className="omnidat-crt-frame">
      <div
        className="omnidat-crt"
        role="application"
        aria-label="OMNIDAT VT100 terminal"
        onClick={() => hiddenRef.current?.focus()}
      >
        <div className="omnidat-crt-screen" data-testid="vt100-screen">
          {rows.map((cells, r) => {
            const isCursorRow = r === screen.cursor.row;
            const runs = runsForRow(cells);
            return (
              // eslint-disable-next-line react/no-array-index-key -- fixed 24-row grid
              <div key={r} className="omnidat-crt-row">
                {runs.map((run) => (
                  <span
                    key={run.start}
                    className={[
                      run.attr.bold ? "v-bold" : "",
                      run.attr.dim ? "v-dim" : "",
                      run.attr.underline ? "v-underline" : "",
                      run.attr.reverse ? "v-reverse" : "",
                      run.attr.blink ? "v-blink" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {run.text}
                  </span>
                ))}
                {isCursorRow ? (
                  <span className="omnidat-crt-input">
                    {input}
                    {screen.cursor.visible ? (
                      <span className="omnidat-crt-cursor" aria-hidden>
                        {" "}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="omnidat-crt-scanlines" aria-hidden />
        <div className="omnidat-crt-vignette" aria-hidden />
        <input
          ref={hiddenRef}
          className="omnidat-crt-capture"
          aria-label="terminal keyboard"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      <div className="omnidat-crt-status">
        <span>{banner.data ? `DTE ${banner.data.x121}` : "CONNECTING…"}</span>
        <span>
          {services.isError
            ? "SIMULATOR"
            : busy
              ? "CALLING…"
              : "READY"}
        </span>
        <span>VT100 · 80×24 · XOT</span>
      </div>
    </div>
  );
}
