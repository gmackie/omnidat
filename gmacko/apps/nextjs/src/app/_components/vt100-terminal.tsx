"use client";

import type { Vt100Cell, Vt100Screen } from "@omnidat/operator-core/vt100";
import { Vt100Terminal, VT, omnidatPrompt } from "@omnidat/operator-core/vt100";
import { attractFrames } from "@omnidat/operator-core/attract";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTRPC } from "~/trpc/react";

// Immersive VT100 operator terminal. The shared @omnidat/operator-core/vt100
// emulator (the same module the server renders through) owns an 80x24 screen
// buffer; this component only feeds it keystrokes and transcripts and paints the
// cells with authentic P1-phosphor CRT styling.
//
// Three modes share the one emulator:
//   pad     — the PAD prompt; verbs run through omnidat.xotCommand (persisted).
//   session — an interactive service session; CALL lands on a full-screen VT100
//             page and verbs route to omnidat.serviceVerb. The command sequence
//             is recorded (omnidat.recordTerminalSession) on exit.
//   attract — the self-playing screensaver (omnidat/attract frames, looped).

const LOCAL_HELP =
  "VERBS: DIR [NS], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCT>, HELP, CLEAR";

type Mode = "pad" | "session" | "attract";

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
  const [mode, setMode] = useState<Mode>("pad");
  const bootedRef = useRef(false);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const sessionX121Ref = useRef<string>(x121);
  const sessionCmdsRef = useRef<string[]>([]);

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

  const paintPad = useCallback(() => {
    term.reset();
    if (banner.data) term.write(banner.data.banner.replace(/\r?\n/gu, "\r\n"));
    term.write(`\r\n${prompt}`);
    sync();
  }, [banner.data, prompt, term, sync]);

  // A full-screen service page owns its layout; drop a command line on row 24 so
  // the live-input overlay (which follows the cursor) has somewhere to echo.
  const paintServicePage = useCallback(
    (page: string) => {
      term.write(page);
      term.write(`${VT.to(24, 1)}\x1b[KCMD> `);
      sync();
    },
    [term, sync],
  );

  // Boot: paint the login banner once it arrives, then the first prompt.
  useEffect(() => {
    if (bootedRef.current || !banner.data) return;
    bootedRef.current = true;
    paintPad();
  }, [banner.data, paintPad]);

  // Attract-mode player: loop the deterministic screensaver frames until exit.
  useEffect(() => {
    if (mode !== "attract") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frames = attractFrames();
    let i = 0;
    term.reset();
    term.write(VT.hideCursor);
    const tick = () => {
      if (cancelled) return;
      const frame = frames[i % frames.length];
      i += 1;
      if (frame) {
        term.write(frame.bytes);
        sync();
        timer = setTimeout(tick, frame.ms);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mode, term, sync]);

  const recordSession = useMutation(
    trpc.omnidat.recordTerminalSession.mutationOptions(),
  );
  const finishSession = useCallback(() => {
    const cmds = sessionCmdsRef.current;
    if (cmds.length > 0) {
      recordSession.mutate({
        x121: sessionX121Ref.current,
        label: `session ${sessionX121Ref.current}`,
        commands: cmds,
      });
    }
    sessionCmdsRef.current = [];
    setMode("pad");
    paintPad();
  }, [recordSession, paintPad]);

  const serviceConnect = useMutation(
    trpc.omnidat.serviceConnect.mutationOptions({
      onSuccess: (screenResult, variables) => {
        if (screenResult.ended) {
          // Unknown address / cleared — show it, then fall back to the PAD.
          term.reset();
          term.write(screenResult.page);
          sync();
          window.setTimeout(() => {
            setMode("pad");
            paintPad();
          }, 1400);
          return;
        }
        sessionX121Ref.current = variables.x121;
        sessionCmdsRef.current = [];
        setMode("session");
        paintServicePage(screenResult.page);
      },
      onError: () => {
        writeln();
        writeln("CLR NA C:11 D:70 — OPERATOR ROLE REQUIRED");
        term.write(`\r\n${prompt}`);
        sync();
      },
      onSettled: () => setBusy(false),
    }),
  );

  const serviceVerb = useMutation(
    trpc.omnidat.serviceVerb.mutationOptions({
      onSuccess: (screenResult) => {
        if (screenResult.ended) {
          term.reset();
          term.write(screenResult.page);
          sync();
          window.setTimeout(finishSession, 1000);
          return;
        }
        paintServicePage(screenResult.page);
      },
      onSettled: () => setBusy(false),
    }),
  );

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
        if (banner.data) term.write(banner.data.banner.replace(/\r?\n/gu, "\r\n"));
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
    setInput("");

    if (mode === "session") {
      // Echo the command on the bottom line, then run the verb server-side.
      term.write(input);
      sync();
      if (!raw) {
        paintServicePage(""); // no-op page just re-drops the CMD line
        return;
      }
      sessionCmdsRef.current.push(raw);
      const [verb = "", ...args] = raw.split(/\s+/);
      setBusy(true);
      serviceVerb.mutate({ x121: sessionX121Ref.current, verb, args });
      return;
    }

    // PAD mode.
    term.write(input);
    if (!raw) {
      term.write(`\r\n${prompt}`);
      sync();
      return;
    }
    setHistory((h) => [raw, ...h].slice(0, 100));
    setHistIdx(-1);
    const [verbRaw = "", ...args] = raw.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    // CALL enters an interactive service session.
    if (verb === "CALL" && args[0]) {
      setBusy(true);
      serviceConnect.mutate({ x121: args[0] });
      sync();
      return;
    }

    if (runLocal(verb, args)) {
      term.write(`\r\n${prompt}`);
      sync();
      return;
    }

    setBusy(true);
    xot.mutate({ sourceX121: x121, command: raw });
    sync();
  }, [
    input,
    mode,
    prompt,
    paintServicePage,
    runLocal,
    serviceConnect,
    serviceVerb,
    sync,
    term,
    x121,
    xot,
  ]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mode === "attract") {
      e.preventDefault();
      setMode("pad");
      paintPad();
      return;
    }
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

  const rows = useMemo(() => screen.rows, [screen]);
  const showInput = mode !== "attract";

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
                {showInput && isCursorRow ? (
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
        <span>
          {mode === "attract"
            ? "ATTRACT — PRESS ANY KEY"
            : mode === "session"
              ? `SESSION ${sessionX121Ref.current}`
              : banner.data
                ? `DTE ${banner.data.x121}`
                : "CONNECTING…"}
        </span>
        <span>
          {services.isError ? "SIMULATOR" : busy ? "CALLING…" : "READY"}
        </span>
        <button
          type="button"
          className="omnidat-crt-btn"
          onClick={() => {
            if (mode === "attract") {
              setMode("pad");
              paintPad();
            } else {
              setMode("attract");
            }
          }}
        >
          {mode === "attract" ? "EXIT" : "ATTRACT"}
        </button>
      </div>
    </div>
  );
}
