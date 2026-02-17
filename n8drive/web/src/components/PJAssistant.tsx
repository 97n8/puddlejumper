"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────── */
interface Position {
  left: number;
  top: number;
}

const POS_KEY = "pj_pos_v3";
const PJ_SIZE = 52;
const EDGE_PAD = 12;
const SNAP_THRESHOLD = 40;

/* ── Helpers ────────────────────────────────────────────── */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as Position;
    if (typeof pos.left === "number" && typeof pos.top === "number") return pos;
  } catch {
    /* ignore */
  }
  return null;
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function defaultPosition(): Position {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  return {
    left: window.innerWidth - PJ_SIZE - EDGE_PAD - 8,
    top: window.innerHeight - PJ_SIZE - EDGE_PAD - 8,
  };
}

function snapToEdge(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  const maxLeft = window.innerWidth - PJ_SIZE - EDGE_PAD;
  const maxTop = window.innerHeight - PJ_SIZE - EDGE_PAD;
  let { left, top } = pos;

  // Snap to edges
  if (left < SNAP_THRESHOLD) left = EDGE_PAD;
  if (left > maxLeft - SNAP_THRESHOLD + EDGE_PAD) left = maxLeft;
  if (top < SNAP_THRESHOLD) top = EDGE_PAD;
  if (top > maxTop - SNAP_THRESHOLD + EDGE_PAD) top = maxTop;

  // Clamp within bounds
  left = clamp(left, 0, maxLeft);
  top = clamp(top, 0, maxTop);

  return { left, top };
}

/* ── Mock command data ──────────────────────────────────── */
interface Command {
  id: string;
  label: string;
  icon: string;
}

const COMMANDS: Command[] = [
  { id: "summarize-dashboard", label: "Summarize Dashboard", icon: "📊" },
  { id: "health-check", label: "Quick Health Check", icon: "🏥" },
  { id: "open-guide", label: "Open Quick Start", icon: "📚" },
];

/* ── Component ──────────────────────────────────────────── */
export default function PJAssistant() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>(() => {
    const saved = loadPosition();
    return saved ? snapToEdge(saved) : defaultPosition();
  });
  const [dragging, setDragging] = useState(false);
  const [commandResult, setCommandResult] = useState<{
    id: string;
    loading: boolean;
    content?: { title: string; items: string[] };
  } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
  } | null>(null);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Drag handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (open) return; // don't drag while panel is open
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: pos.left,
        startTop: pos.top,
        moved: false,
      };
      setDragging(true);
    },
    [open, pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }
      setPos({
        left: dragRef.current.startLeft + dx,
        top: dragRef.current.startTop + dy,
      });
    },
    []
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const wasDrag = dragRef.current.moved;
    const snapped = snapToEdge(pos);
    setPos(snapped);
    savePosition(snapped);
    dragRef.current = null;
    setDragging(false);
    if (!wasDrag) {
      setOpen((o) => !o);
    }
  }, [pos]);

  // Command execution
  const handleCommand = useCallback((cmd: Command) => {
    if (cmd.id === "open-guide") {
      window.location.href = "/pj/guide";
      return;
    }

    setCommandResult({ id: cmd.id, loading: true });

    if (cmd.id === "summarize-dashboard") {
      setTimeout(() => {
        setCommandResult({
          id: cmd.id,
          loading: false,
          content: {
            title: "Dashboard Summary",
            items: [
              "Revenue running +3.7% vs forecast",
              "3 open 30-day items need attention",
              "Retention mapping 72% complete",
            ],
          },
        });
      }, 700);
      return;
    }

    if (cmd.id === "health-check") {
      setTimeout(() => {
        setCommandResult({
          id: cmd.id,
          loading: false,
          content: {
            title: "Health Check",
            items: ["All systems operational ✓"],
          },
        });
      }, 500);
      return;
    }
  }, []);

  return (
    <>
      {/* ── Overlay ──────────────────────────────────── */}
      {open && (
        <div
          id="overlay"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 9998,
          }}
        />
      )}

      {/* ── Panel ────────────────────────────────────── */}
      {open && (
        <div
          id="panel"
          className="open"
          role="dialog"
          aria-label="PJ Command Center"
          style={{
            position: "fixed",
            right: 16,
            bottom: PJ_SIZE + 24,
            width: 340,
            maxHeight: "70vh",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: "#222",
          }}
        >
          {/* Header */}
          <div
            id="command-header"
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #e6eaf2",
              fontWeight: 700,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>PJ Command Center</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close panel"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#888",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Command body */}
          <div
            className="command-body"
            style={{
              padding: 12,
              overflowY: "auto",
              flex: 1,
            }}
          >
            {COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                className="command-btn"
                data-cmd={cmd.id}
                onClick={() => handleCommand(cmd)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: 6,
                  background: "#f7f9fc",
                  border: "1px solid #e6eaf2",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#333",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#eef3ff")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#f7f9fc")
                }
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  {cmd.icon}
                </span>
                {cmd.label}
              </button>
            ))}

            {/* Command result */}
            {commandResult && (
              <div
                id="pj-mock-result"
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: commandResult.loading
                    ? "1px solid #e6eaf2"
                    : "1px solid #d5e3ff",
                  background: commandResult.loading ? "#fff" : "#f0f6ff",
                }}
              >
                {commandResult.loading ? (
                  <>
                    <div style={{ fontWeight: 600 }}>Processing…</div>
                    <div style={{ color: "#666", marginTop: 8 }}>
                      Generating response
                    </div>
                  </>
                ) : commandResult.content ? (
                  <div>
                    <strong>{commandResult.content.title}</strong>
                    <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                      {commandResult.content.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Floating button ──────────────────────────── */}
      <button
        id="pj"
        type="button"
        aria-label="Open PJ assistant"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          width: PJ_SIZE,
          height: PJ_SIZE,
          borderRadius: "50%",
          background: dragging
            ? "linear-gradient(135deg, #3b5bdb, #5f3dc4)"
            : "linear-gradient(135deg, #4c6ef5, #7048e8)",
          border: "2px solid rgba(255,255,255,0.25)",
          boxShadow: dragging
            ? "0 8px 24px rgba(76,110,245,0.5)"
            : "0 4px 16px rgba(76,110,245,0.35)",
          cursor: dragging ? "grabbing" : "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          touchAction: "none",
          transition: dragging ? "none" : "box-shadow 0.2s, transform 0.2s",
          transform: dragging ? "scale(1.08)" : "scale(1)",
          userSelect: "none",
          color: "#fff",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        PJ
      </button>
    </>
  );
}
