import React, { useState, useEffect, useRef, useCallback } from "react";
import { Flame, Wallet, ShieldCheck, Radio, Terminal, RefreshCw, Lock, Unlock, Sun, Moon } from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap";

const THEMES = {
  dark: {
    void: "#0B0D0F",
    panel: "#14171A",
    panelAlt: "#0F1113",
    line: "#262B2F",
    lineSoft: "#1C2024",
    ink: "#E9EDEF",
    inkDim: "#8A9299",
    redacted: "#4A5157",
    ember: "#FF5A3C",
    emberOn: "#0B0D0F",
    cipher: "#35E0C4",
    cipherWash: "rgba(53,224,196,0.12)",
    cipherBorder: "rgba(53,224,196,0.35)",
    glowA: "rgba(255,90,60,0.10)",
    glowB: "rgba(53,224,196,0.08)",
  },
  light: {
    void: "#EEF0F1",
    panel: "#FFFFFF",
    panelAlt: "#F5F6F7",
    line: "#DBE0E3",
    lineSoft: "#E7EAEC",
    ink: "#14171A",
    inkDim: "#5B6368",
    redacted: "#B9BFC3",
    ember: "#D9431C",
    emberOn: "#FFFFFF",
    cipher: "#0B9084",
    cipherWash: "rgba(11,144,132,0.08)",
    cipherBorder: "rgba(11,144,132,0.35)",
    glowA: "rgba(217,67,28,0.07)",
    glowB: "rgba(11,144,132,0.06)",
  },
};

const ASSETS = [
  { symbol: "FLR", feed: "FLR/USD", basePrice: 0.0234, realAmount: 128400 },
  { symbol: "FXRP", feed: "XRP/USD", basePrice: 0.61, realAmount: 3200 },
  { symbol: "WETH", feed: "ETH/USD", basePrice: 3410.2, realAmount: 1.85 },
  { symbol: "FBTC", feed: "BTC/USD", basePrice: 68420.5, realAmount: 0.09 },
];

function useLivePrices() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(ASSETS.map((a) => [a.feed, a.basePrice]))
  );
  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };
        ASSETS.forEach((a) => {
          const drift = (Math.random() - 0.5) * a.basePrice * 0.004;
          next[a.feed] = Math.max(0.0001, prev[a.feed] + drift);
        });
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return prices;
}

function fmtPrice(v) {
  if (v > 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v > 1) return v.toFixed(2);
  return v.toFixed(4);
}

function fakeHash(seed) {
  const chars = "0123456789abcdef";
  let out = "0x";
  let s = seed;
  for (let i = 0; i < 40; i++) {
    s = (s * 9301 + 49297) % 233280;
    out += chars[Math.floor((s / 233280) * 16)];
  }
  return out;
}

function ScrambleValue({ text, revealed, scrambling }) {
  const chars = "0123456789";
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    if (!scrambling) {
      setDisplay(text);
      return;
    }
    let ticks = 0;
    const id = setInterval(() => {
      ticks++;
      setDisplay(
        text
          .split("")
          .map((c, i) => {
            if (c === "." || c === "$" || c === "," || c === " ") return c;
            if (ticks > 8 && i < ticks - 8) return c;
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      if (ticks > text.length + 8) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [scrambling, text]);

  return (
    <span className="font-mono" style={{ letterSpacing: "0.02em" }}>
      {revealed || scrambling ? display : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
    </span>
  );
}

export default function FlareVaultDemo() {
  const [mode, setMode] = useState("dark");
  const t = THEMES[mode];
  const prices = useLivePrices();
  const [connected, setConnected] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [log, setLog] = useState([]);
  const [commitment] = useState(() => fakeHash(42));
  const logEndRef = useRef(null);

  const pushLog = useCallback((line) => {
    setLog((prev) => [...prev.slice(-30), { line, t: new Date().toLocaleTimeString() }]);
  }, []);

  useEffect(() => {
    pushLog("Position commitment stored on-chain (PortfolioVault.commitPosition)");
  }, [pushLog]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const totalUsd = ASSETS.reduce((sum, a) => sum + a.realAmount * prices[a.feed], 0);

  function connectWallet() {
    setConnected(true);
    pushLog("Wallet connected: 0x8f2b...C29e (Coston2)");
  }

  function revealInEnclave() {
    if (revealing) return;
    setRevealing(true);
    setRevealed(false);
    pushLog("Instruction sent → PortfolioInstructionSender.sendValueHoldings()");
    setTimeout(() => pushLog("TEE fetched live FTSOv2 prices for 4 tracked feeds"), 500);
    setTimeout(() => pushLog("Enclave computed USD valuation from raw holdings"), 1100);
    setTimeout(() => {
      pushLog("Result signed by TEE identity, returned to caller — raw amounts discarded");
      setRevealed(true);
      setRevealing(false);
    }, 1700);
  }

  function hidePosition() {
    setRevealed(false);
    pushLog("Valuation cleared from view (raw holdings never left the enclave)");
  }

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300"
      style={{
        background: `radial-gradient(ellipse at 20% -10%, ${t.glowA}, transparent 45%), radial-gradient(ellipse at 90% 10%, ${t.glowB}, transparent 40%), ${t.void}`,
        color: t.ink,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <style>{`@import url('${FONT_IMPORT_URL}'); .font-mono { font-family: 'JetBrains Mono', monospace; }`}</style>

      <header
        className="flex items-center justify-between px-6 py-5 border-b transition-colors duration-300"
        style={{ borderColor: t.line }}
      >
        <div className="flex items-center gap-2.5">
          <Flame size={22} color={t.ember} strokeWidth={2.4} />
          <span className="text-lg font-bold tracking-tight">FLARE VAULT</span>
          <span
            className="ml-3 flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-mono"
            style={{ background: t.panel, color: t.inkDim, border: `1px solid ${t.line}` }}
          >
            <Radio size={11} color={t.cipher} /> Coston2 testnet · chain 114
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            aria-label="Toggle light and dark mode"
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ background: t.panel, border: `1px solid ${t.line}`, color: t.inkDim }}
          >
            {mode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={connectWallet}
            className="flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
            style={{
              background: connected ? t.panel : t.ember,
              color: connected ? t.cipher : t.emberOn,
              border: connected ? `1px solid ${t.line}` : "none",
            }}
          >
            <Wallet size={15} />
            {connected ? "0x8f2b…C29e" : "Connect Wallet"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <p className="text-sm leading-relaxed" style={{ color: t.inkDim, maxWidth: "56ch" }}>
            A private, cross-chain portfolio tracker. Holdings are committed on-chain as a hash —
            only you can compute the real USD value, inside a Flare Confidential Compute enclave.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASSETS.map((a) => (
            <div
              key={a.feed}
              className="rounded-xl px-4 py-3 transition-colors duration-300"
              style={{ background: t.panel, border: `1px solid ${t.line}` }}
            >
              <div className="text-xs font-mono mb-1" style={{ color: t.inkDim }}>
                {a.feed}
              </div>
              <div className="text-lg font-mono font-medium" style={{ color: t.ember }}>
                ${fmtPrice(prices[a.feed])}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ border: `1px solid ${t.line}` }}>
          <div
            className="flex items-center justify-between px-5 py-3.5 transition-colors duration-300"
            style={{ background: t.panel, borderBottom: `1px solid ${t.line}` }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={16} color={t.cipher} />
              Holdings — commitment
              <span className="font-mono text-xs" style={{ color: t.inkDim }}>
                {commitment.slice(0, 10)}…{commitment.slice(-6)}
              </span>
            </div>
            <button
              onClick={revealed ? hidePosition : revealInEnclave}
              disabled={revealing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg font-mono"
              style={{
                background: revealed ? t.panelAlt : t.cipherWash,
                color: t.cipher,
                border: `1px solid ${t.cipherBorder}`,
                opacity: revealing ? 0.6 : 1,
              }}
            >
              {revealed ? <Unlock size={12} /> : <Lock size={12} />}
              {revealing ? "computing in TEE…" : revealed ? "Hide" : "Reveal via TEE"}
            </button>
          </div>

          <div className="divide-y" style={{ borderColor: t.line }}>
            {ASSETS.map((a) => (
              <div
                key={a.symbol}
                className="flex items-center justify-between px-5 py-3.5 transition-colors duration-300"
                style={{ borderColor: t.lineSoft }}
              >
                <span className="text-sm font-medium">{a.symbol}</span>
                <span className="text-sm" style={{ color: revealed || revealing ? t.ink : t.redacted }}>
                  <ScrambleValue
                    text={a.realAmount.toLocaleString()}
                    revealed={revealed}
                    scrambling={revealing}
                  />
                </span>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between px-5 py-4 transition-colors duration-300"
            style={{ background: t.panel, borderTop: `1px solid ${t.line}` }}
          >
            <span className="text-sm font-medium" style={{ color: t.inkDim }}>
              TOTAL VALUE
            </span>
            <span className="text-xl font-mono font-bold" style={{ color: revealed ? t.cipher : t.redacted }}>
              $
              <ScrambleValue
                text={totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                revealed={revealed}
                scrambling={revealing}
              />
            </span>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ border: `1px solid ${t.line}` }}>
          <div
            className="flex items-center gap-2 px-5 py-3 transition-colors duration-300"
            style={{ background: t.panel, borderBottom: `1px solid ${t.line}` }}
          >
            <Terminal size={14} color={t.inkDim} />
            <span className="text-xs font-mono" style={{ color: t.inkDim }}>
              TEE ACTIVITY LOG
            </span>
          </div>
          <div
            className="px-5 py-4 space-y-1.5 font-mono text-xs max-h-40 overflow-y-auto transition-colors duration-300"
            style={{ background: t.panelAlt }}
          >
            {log.map((entry, i) => (
              <div key={i} style={{ color: t.inkDim }}>
                <span style={{ color: t.cipher }}>[{entry.t}]</span> {entry.line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs pt-2" style={{ color: t.redacted }}>
          <RefreshCw size={11} /> Prices simulate live FTSOv2 feed drift for demo purposes — see README for real on-chain wiring.
        </div>
      </main>
    </div>
  );
}
