import { useState, useRef, useEffect, useCallback } from "react";
import { FILTERS, FILTER_KEYS, pixelate } from "./filters";
import "./App.css";

const DEFAULT_SETTINGS = {
  blockSize: 8,
  filter: "none",
  contrast: 0,
  brightness: 100,
  saturation: 100,
  dither: false,
  showGrid: false,
};

export default function App() {
  const [image, setImage] = useState(null); // original Image object with custom .computedW/H properties
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dragging, setDragging] = useState(false);
  const [rendering, setRendering] = useState(false);

  const fileRef = useRef(null);
  const srcCanvasRef = useRef(null); // hidden: holds original pixels
  const outCanvasRef = useRef(null); // visible: holds pixelated result

  // Synchronize canvas manipulations with image/settings updates
  useEffect(() => {
    if (!image) return;

    const w = image.computedW;
    const h = image.computedH;

    const src = srcCanvasRef.current;
    const out = outCanvasRef.current;
    const srcCtx = src.getContext("2d");
    const outCtx = out.getContext("2d");

    // Prepare hidden source canvas immediately
    src.width = w;
    src.height = h;
    srcCtx.drawImage(image, 0, 0, w, h);

    // Run pixel computations inside a macro-task timeout
    // to keep the UI responsive and let the rendering overlay display.
    const renderTimeout = setTimeout(() => {
      out.width = w;
      out.height = h;

      const imageData = srcCtx.getImageData(0, 0, w, h);
      const result = pixelate({
        imageData,
        width: w,
        height: h,
        blockSize: settings.blockSize,
        filter: settings.filter,
        contrast: settings.contrast,
        brightness: settings.brightness,
        saturation: settings.saturation,
        dither: settings.dither,
      });
      outCtx.putImageData(result, 0, 0);

      // Grid overlay
      if (settings.showGrid) {
        outCtx.strokeStyle = "rgba(0,0,0,0.25)";
        outCtx.lineWidth = 0.5;
        for (let x = 0; x < w; x += settings.blockSize) {
          outCtx.beginPath();
          outCtx.moveTo(x, 0);
          outCtx.lineTo(x, h);
          outCtx.stroke();
        }
        for (let y = 0; y < h; y += settings.blockSize) {
          outCtx.beginPath();
          outCtx.moveTo(0, y);
          outCtx.lineTo(w, y);
          outCtx.stroke();
        }
      }

      setRendering(false);
    }, 200); // Short delay to guarantee the browser renders the loader frame

    return () => clearTimeout(renderTimeout);
  }, [image, settings]);

  // Handle file input
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.width,
        h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      // Store dimensions safely directly on the object
      img.computedW = w;
      img.computedH = h;

      setRendering(true); // Flag rendering safely on user event
      setImage(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const onFileChange = (e) => loadFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadFile(e.dataTransfer.files[0]);
  };

  // Download
  const download = () => {
    const a = document.createElement("a");
    a.href = outCanvasRef.current.toDataURL("image/png");
    a.download = `pixellater-${settings.filter}-${settings.blockSize}px.png`;
    a.click();
  };

  // Helper setter that flips the rendering flag first
  const set = (key, val) => {
    setRendering(true);
    setSettings((s) => ({ ...s, [key]: val }));
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div>
          <h1 className="logo">
            PIXEL<span>LATER</span>
          </h1>
          <p className="tagline">guesss what</p>
        </div>
      </header>

      <main className="workspace">
        {/* Left: Controls*/}
        <aside className="panel">
          {/* Upload zone */}
          <section className="section">
            <label className="section-label">[ INPUT ]</label>
            <div
              className={`drop-zone ${dragging ? "drag-over" : ""} ${image ? "has-image" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
            >
              {image ? (
                <span className="dz-hint">▶ image loaded — click to swap</span>
              ) : (
                <>
                  <span className="dz-icon">⬛</span>
                  <span className="dz-hint">
                    drop image here
                    <br />
                    or click to browse
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              hidden
            />
          </section>

          {/* Block size */}
          <section className="section">
            <label className="section-label">
              [ PIXEL SIZE ] <span className="val">{settings.blockSize}px</span>
            </label>
            <div className="slider-row">
              <span className="sl-hint">fine</span>
              <input
                type="range"
                min={2}
                max={64}
                value={settings.blockSize}
                onChange={(e) => set("blockSize", +e.target.value)}
              />
              <span className="sl-hint">chunky</span>
            </div>
            <div className="grid-sz">
              {[2, 4, 6, 8, 12, 16, 24, 32, 48, 64].map((n) => (
                <button
                  key={n}
                  className={`sz-btn ${settings.blockSize === n ? "active" : ""}`}
                  onClick={() => set("blockSize", n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          {/* Colour filter */}
          <section className="section">
            <label className="section-label">[ COLOUR FILTER ]</label>
            <div className="filter-grid">
              {FILTER_KEYS.map((k) => (
                <button
                  key={k}
                  className={`filter-btn ${settings.filter === k ? "active" : ""}`}
                  onClick={() => set("filter", k)}
                  title={FILTERS[k].desc}
                >
                  {FILTERS[k].label}
                </button>
              ))}
            </div>
          </section>

          {/* Adjustments */}
          <section className="section">
            <label className="section-label">[ ADJUSTMENTS ]</label>
            {[
              {
                key: "brightness",
                label: "Brightness",
                min: 0,
                max: 200,
                def: 100,
              },
              {
                key: "contrast",
                label: "Contrast",
                min: -100,
                max: 100,
                def: 0,
              },
              {
                key: "saturation",
                label: "Saturation",
                min: 0,
                max: 300,
                def: 100,
              },
            ].map(({ key, label, min, max, def }) => (
              <div key={key} className="adj-row">
                <span className="adj-label">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={settings[key]}
                  onChange={(e) => set(key, +e.target.value)}
                />
                <span className="adj-val">{settings[key]}</span>
                <button
                  className="reset-btn"
                  onClick={() => set(key, def)}
                  title="Reset"
                >
                  ↺
                </button>
              </div>
            ))}
          </section>

          {/* Toggles */}
          <section className="section toggles">
            <label className="section-label">[ OPTIONS ]</label>
            <div className="toggle-row">
              <button
                className={`toggle-btn ${settings.dither ? "active" : ""}`}
                onClick={() => set("dither", !settings.dither)}
              >
                {settings.dither ? "▣" : "□"} Dither
              </button>
              <button
                className={`toggle-btn ${settings.showGrid ? "active" : ""}`}
                onClick={() => set("showGrid", !settings.showGrid)}
              >
                {settings.showGrid ? "▣" : "□"} Grid
              </button>
              <button
                className="toggle-btn reset-all"
                onClick={() => {
                  setRendering(true);
                  setSettings(DEFAULT_SETTINGS);
                }}
              >
                ↺ Reset all
              </button>
            </div>
          </section>

          {/* Download */}
          <button className="download-btn" onClick={download} disabled={!image}>
            ▼ DOWNLOAD PNG
          </button>
        </aside>

        {/* Right: Canvas */}
        <section className="canvas-area">
          {!image && (
            <div className="canvas-placeholder">
              <div className="placeholder-art">
                {[...Array(8)].map((_, r) => (
                  <div key={r} className="ph-row">
                    {[...Array(8)].map((_, c) => {
                      const on =
                        (r + c) % 3 === 0 ||
                        (r === 3 && c === 3) ||
                        (r === 4 && c === 4);
                      return (
                        <div key={c} className={`ph-cell ${on ? "on" : ""}`} />
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="ph-text">upload an image to begin</p>
            </div>
          )}
          <div className={`canvas-wrap ${!image ? "hidden" : ""}`}>
            {rendering && <div className="render-overlay">rendering…</div>}
            <canvas ref={outCanvasRef} className="output-canvas" />
          </div>
          {/* Hidden source canvas */}
          <canvas ref={srcCanvasRef} style={{ display: "none" }} />

          {image && (
            <div className="canvas-meta">
              <span>
                {image.computedW} × {image.computedH}px
              </span>
              <span>·</span>
              <span>
                {Math.ceil(image.computedW / settings.blockSize)} ×{" "}
                {Math.ceil(image.computedH / settings.blockSize)} blocks
              </span>
              <span>·</span>
              <span>{FILTERS[settings.filter]?.label}</span>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>CapsD | Maynkudu</span>
        <span>no data leaves your device</span>
      </footer>
    </div>
  );
}
