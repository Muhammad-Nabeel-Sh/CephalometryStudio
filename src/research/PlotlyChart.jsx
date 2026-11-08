/* eslint-disable react-refresh/only-export-components */
import { useRef, useEffect, useState, useMemo, useCallback } from "react";

const FONT_STACK = "'DM Sans','DM Mono',monospace";
const FAILED = "Chart library failed to load.";

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function heatmapLayout(t, extra) {
  return {
    paper_bgcolor: t.surf,
    plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 12 },
    xaxis: { side: "top", tickangle: -30, tickfont: { size: 11 }, gridcolor: t.surf3, zeroline: false, title: { font: { size: 13 } } },
    yaxis: { tickfont: { size: 11 }, gridcolor: t.surf3, zeroline: false, autorange: "reversed", title: { font: { size: 13 } } },
    margin: { l: 90, r: 20, t: 60, b: 20 },
    ...extra,
  };
}

export function heatmapData(z, xLabels, yLabels, text, extra) {
  return [{
    z,
    x: xLabels,
    y: yLabels || xLabels,
    type: "heatmap",
    text: text || null,
    hovertemplate: "%{x} \u00d7 %{y}: %{z:.3f}<extra></extra>",
    hoverongaps: false,
    ...extra,
  }];
}

const fullBtn = (t) => ({
  position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 4, zIndex: 10,
  border: `1px solid ${t?.bdr || "#444"}`, background: t?.surf3 || "#2a2a3e",
  color: t?.tx2 || "#888", cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: 13, lineHeight: 1, opacity: 0.5, transition: "opacity 0.15s",
});

export default function PlotlyChart({ data, layout, config, style }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [fullscreen, setFullscreen] = useState(false);
  const plotlyRef = useRef(null);

  // Inject font size bumps + minor grid defaults into all cartesian axes
  const enrichedLayout = useMemo(() => {
    if (!layout) return layout;
    const out = deepClone(layout);
    // Charts always fit their container's width (a fixed width overflows narrow
    // columns, e.g. side by side); the height stays as the chart asks.
    delete out.width;
    out.autosize = true;
    // Bump base font
    if (out.font && out.font.size != null && out.font.size < 12) out.font.size = 12;
    for (const key of Object.keys(out)) {
      if (key.startsWith("xaxis") || key.startsWith("yaxis")) {
        const ax = out[key];
        if (ax && typeof ax === "object") {
          ax.minor = { ...(ax.minor || {}), showgrid: true, gridcolor: ax.gridcolor ? ax.gridcolor + "44" : "#33333344", gridwidth: 0.5 };
          // Bump tick font
          if (ax.tickfont && ax.tickfont.size != null && ax.tickfont.size < 11) ax.tickfont.size = 11;
          // Bump axis title font
          if (ax.title && typeof ax.title === "object") {
            if (!ax.title.font) ax.title.font = { size: 13 };
            else if (ax.title.font.size != null && ax.title.font.size < 12) ax.title.font.size = 12;
          }
        }
      }
    }
    // Bump legend font
    if (out.legend?.font?.size != null && out.legend.font.size < 11) out.legend.font.size = 11;
    return out;
  }, [layout]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) {
      wrapRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setFullscreen(fs);
      if (ref.current && plotlyRef.current) {
        setTimeout(() => plotlyRef.current.Plots.resize(ref.current), 100);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !data) return;
    let cancelled = false;

    import("plotly.js-basic-dist-min").then(Plotly => {
      if (cancelled || el !== ref.current) return;
      plotlyRef.current = Plotly;
      Plotly.newPlot(el, deepClone(data), enrichedLayout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["select2d", "lasso2d", "hoverClosestCartesian", "hoverCompareCartesian", "toggleSpikelines"],
        scrollZoom: true,
        toImageButtonOptions: { format: "png", filename: "chart", width: null, height: null, scale: 2 },
        ...(config || {}),
      });
      Plotly.Plots.resize(el);
      setStatus("ok");
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });

    // Plotly's `responsive` only follows window resizes. The chart's own box also
    // changes when the results switch between tables, charts and side by side, or a
    // panel opens, so follow the container and refit (debounced; a timer rather than
    // requestAnimationFrame, which doesn't run while the page is in the background).
    let timer = 0;
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled && plotlyRef.current && el.isConnected && el.clientWidth > 0) plotlyRef.current.Plots.resize(el);
      }, 60);
    }) : null;
    ro?.observe(el);

    return () => {
      cancelled = true;
      ro?.disconnect();
      clearTimeout(timer);
      if (plotlyRef.current && el) {
        plotlyRef.current.purge(el);
        plotlyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") return <div style={{ padding: 40, textAlign: "center", color: "#999", fontFamily: FONT_STACK, fontSize: 12 }}>{FAILED}</div>;
  if (!data) return null;

  const wrapStyles = {
    position: "relative", width: "100%",
    background: layout?.paper_bgcolor || "#1a1a2e",
    ...(fullscreen ? { height: "100vh", display: "flex", flexDirection: "column" } : {}),
  };
  const chartStyles = {
    width: "100%",
    ...(fullscreen ? { flex: 1, minHeight: 0 } : { minHeight: 300 }),
    ...style,
  };

  return (
    <div ref={wrapRef} style={wrapStyles}>
      {status === "ok" && (
        <button onClick={toggleFullscreen} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          style={fullBtn({ bdr: "#444", surf3: "#2a2a3e", tx2: "#888" })}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
          {fullscreen ? "⤓" : "⛶"}
        </button>
      )}
      <div ref={ref} style={chartStyles} />
    </div>
  );
}
