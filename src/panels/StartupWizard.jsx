import { useState, useRef, useCallback } from "react";
import { PREDEFINED } from "../data/constants.js";
import { Btn, Tag, GuideBtn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { notify } from "../ui/dialogs.js";

const projectionKeyMap={
  "Submentovertex (SMV)":"smv",
  "Panoramic Radiograph (OPG)":"opg",
  "Hand-Wrist Radiograph":"handwrist",
};
function getOtherAnalysis(name){
  const key=projectionKeyMap[name];
  if(key&&PREDEFINED[key]&&PREDEFINED[key].length>0)return PREDEFINED[key][0];
  return null;
}

function StepDots({ current, total, t }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: "50%",
          background: i === current ? t.acc : (i < current ? t.ok : t.surf3),
          transition: "all 0.2s",
        }}/>
      ))}
    </div>
  );
}

function StepImage({ t, initialPreview, onImage, onNext }) {
  const [preview, setPreview] = useState(initialPreview || null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      onImage({ file, dataUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  }, [onImage]);

  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: t.tx, marginBottom: 4 }}>
        Step 1 · Load Image
      </div>
      <div style={{ fontSize: 13, color: t.tx2, marginBottom: 20 }}>
        Drag & drop a cephalometric radiograph, or click to browse.
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); load(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? t.acc : t.bdr}`,
          borderRadius: 14, padding: preview ? 12 : 60, textAlign: "center",
          cursor: "pointer", background: dragOver ? t.accMuted : t.surf2,
          transition: "all 0.15s", marginBottom: 16,
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) load(e.target.files[0]); e.target.value = ""; }}
        />
        {preview ? (
          <img src={preview} alt="Preview" style={{
            maxWidth: "100%", maxHeight: 260, borderRadius: 8,
            objectFit: "contain", display: "block", margin: "0 auto",
          }}/>
        ) : (
          <div style={{ color: t.tx3, fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>+</div>
            <div style={{ fontWeight: 600, color: t.tx2, marginBottom: 4 }}>Click or drop image here</div>
            <div style={{ fontSize: 11 }}>Supports PNG and JPEG</div>
          </div>
        )}
      </div>

      {preview && (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn t={t} onClick={() => { setPreview(null); onImage(null); }} small style={{ flex: 1 }}>
            Remove
          </Btn>
          <Btn t={t} onClick={onNext} small style={{ flex: 1 }}>
            Next →
          </Btn>
        </div>
      )}
    </div>
  );
}

function StepCalibrate({ t, imageDataUrl, onCalibrate }) {
  const [mode, setMode] = useState("ruler");
  const [rulerStart, setRulerStart] = useState(null);
  const [rulerEnd, setRulerEnd] = useState(null);
  const [knownMm, setKnownMm] = useState("10");
  const [manualPpm, setManualPpm] = useState("");
  const [imgSize, setImgSize] = useState(null);
  const imgRef = useRef(null);

  const handleImgClick = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (!rulerStart) {
      setRulerStart({ x, y });
      setRulerEnd(null);
    } else if (!rulerEnd) {
      setRulerEnd({ x, y });
    } else {
      setRulerStart({ x, y });
      setRulerEnd(null);
    }
  };

  const pxPerMm = rulerStart && rulerEnd && knownMm && imgSize
    ? Math.sqrt(
        ((rulerEnd.x - rulerStart.x) * imgSize.w) ** 2 +
        ((rulerEnd.y - rulerStart.y) * imgSize.h) ** 2
      ) / parseFloat(knownMm)
    : null;

  const finalPpm = mode === "ruler" ? pxPerMm : (manualPpm ? parseFloat(manualPpm) : null);
  const calibrated = finalPpm && isFinite(finalPpm) && finalPpm > 0;

  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: t.tx, marginBottom: 4 }}>
        Step 2 · Calibrate
      </div>
      <div style={{ fontSize: 13, color: t.tx2, marginBottom: 20 }}>
        Set the pixel-to-millimeter ratio for accurate measurements.
      </div>

      {imageDataUrl && (
        <div style={{ marginBottom: 16, position: "relative", background: "#000", borderRadius: 8, overflow: "hidden" }}>
          <img
            ref={imgRef}
            src={imageDataUrl}
            alt="Ruler image"
            style={{ width: "100%", maxHeight: "50vh", objectFit: "contain", cursor: mode === "ruler" ? "crosshair" : "default", display: "block" }}
            onClick={mode === "ruler" ? handleImgClick : undefined}
            onLoad={() => {
              if (imgRef.current) {
                setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
              }
            }}
          />
          {mode === "ruler" && rulerStart && imgSize && (
            <div style={{
              position: "absolute",
              left: `${rulerStart.x * 100}%`, top: `${rulerStart.y * 100}%`,
              width: 10, height: 10, borderRadius: "50%",
              background: t.acc, transform: "translate(-50%,-50%)",
              boxShadow: "0 0 0 2px #fff",
            }}/>
          )}
          {mode === "ruler" && rulerEnd && imgSize && rulerStart && (
            <div style={{
              position: "absolute",
              left: `${rulerEnd.x * 100}%`, top: `${rulerEnd.y * 100}%`,
              width: 10, height: 10, borderRadius: "50%",
              background: t.err, transform: "translate(-50%,-50%)",
              boxShadow: "0 0 0 2px #fff",
            }}/>
          )}
          {mode === "ruler" && rulerEnd && imgSize && rulerStart && pxPerMm && (
            <div style={{
              position: "absolute",
              left: `${(rulerStart.x + rulerEnd.x) / 2 * 100}%`,
              top: `${Math.min(rulerStart.y, rulerEnd.y) * 100 - 4}%`,
              background: t.bg, color: t.ok, fontSize: 10,
              padding: "1px 6px", borderRadius: 4,
              transform: "translate(-50%,-100%)",
              fontFamily: "'DM Mono',monospace",
              whiteSpace: "nowrap",
            }}>
              {finalPpm?.toFixed(1)} px/mm
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["ruler", "manual"].map((m) => (
          <Btn key={m} t={t} small active={mode === m} onClick={() => { setMode(m); setRulerStart(null); setRulerEnd(null); }} style={{ flex: 1 }}>
            {m === "ruler" ? "From Ruler" : "Manual px/mm"}
          </Btn>
        ))}
      </div>

      {mode === "ruler" ? (
        <div>
          {!rulerStart ? (
            <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", marginBottom: 12 }}>
              Click on the image to place the ruler start point, then click again for the end point.
            </div>
          ) : !rulerEnd ? (
            <div style={{ fontSize: 12, color: t.acc, textAlign: "center", marginBottom: 12 }}>
              Now click on the image to place the ruler end point.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: t.tx2, marginBottom: 4 }}>Known distance of the drawn ruler (mm)</div>
              <input type="number" value={knownMm}
                onChange={(e) => setKnownMm(e.target.value)}
                min="0.1" step="0.5"
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`,
                  background: t.surf3, color: t.tx, fontSize: 14, fontFamily: "'DM Mono',monospace",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: t.tx2, marginBottom: 4 }}>Pixels per millimeter (from DICOM metadata)</div>
          <input type="number" value={manualPpm}
            onChange={(e) => setManualPpm(e.target.value)}
            min="0.001" step="0.1"
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`,
              background: t.surf3, color: t.tx, fontSize: 14, fontFamily: "'DM Mono',monospace",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn t={t} onClick={() => onCalibrate(null)} style={{ flex: 1 }}>
          Skip Calibration
        </Btn>
        <Btn t={t} onClick={() => {
          if (mode === "ruler") {
            onCalibrate({ pxPerMm: finalPpm, knownMm: parseFloat(knownMm) });
          } else {
            onCalibrate({ pxPerMm: finalPpm, knownMm: "" });
          }
        }} disabled={!calibrated} style={{ flex: 1 }}>
          {calibrated ? "Confirm" : "Calibrate First"}
        </Btn>
      </div>
    </div>
  );
}

function StepPickProjection({ t, onPick }) {
  const otherGroups = PREDEFINED.other || [];
  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: t.tx, marginBottom: 4 }}>
        Step 1 · Choose Projection
      </div>
      <div style={{ fontSize: 13, color: t.tx2, marginBottom: 20 }}>
        Select the radiographic projection for this analysis.
      </div>
      {otherGroups.map(group => (
        <div key={group.group} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{group.group}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.projections.map(p => (
              <div key={p.name} onClick={() => {
                const analysis = getOtherAnalysis(p.name);
                onPick(p.name, analysis);
              }}
                style={{ padding: "12px 14px", border: `1px solid ${p.color}88`, borderRadius: 10, cursor: "pointer", background: t.surf2, borderLeft: `4px solid ${p.color}`, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = t.accMuted; }}
                onMouseLeave={e => { e.currentTarget.style.background = t.surf2; }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: t.tx, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>{p.def}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Btn t={t} onClick={() => onPick(null, null)} style={{ width: "100%", marginTop: 8 }}>Cancel</Btn>
    </div>
  );
}

function StepTemplate({ t, projection, onPick }) {
  const [step, setStep] = useState("choose");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const templateRef = useRef(null);

  const analyses = PREDEFINED[projection] || [];

  const options = [
    { id: "blank", icon: "☐", title: "Blank", desc: "Start with a clean canvas. Place your own landmarks, lines, and measurements." },
    { id: "analysis", icon: "⊛", title: "Analysis Template", desc: "Select a predefined landmark set (Steiner, Ricketts, McNamara…) for guided placement." },
    { id: "complete", icon: "⬡", title: "Complete Analysis", desc: "Load all landmark points + standard measurement planes for the selected analysis." },
    { id: "upload", icon: "↑", title: "Upload Template", desc: "Import a .cepht template file shared by a colleague or from a previous case." },
  ];

  if (step === "analysis") return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: t.tx, marginBottom: 4 }}>Select Analysis</div>
      <div style={{ fontSize: 12, color: t.tx2, marginBottom: 16 }}>Choose the analysis landmark set to load.</div>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
        {analyses.map((a) => (
          <div key={a.name} onClick={() => setSelectedAnalysis(a.name)}
            style={{
              padding: "10px 14px", marginBottom: 6, border: `1px solid ${selectedAnalysis === a.name ? t.acc : t.bdr}`,
              borderRadius: 8, cursor: "pointer", background: selectedAnalysis === a.name ? t.accMuted : t.surf2,
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: t.tx, marginBottom: 4 }}>{a.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {a.pts.slice(0, 8).map((pt) => <Tag key={pt.l} color={pt.color}>{pt.l}</Tag>)}
              {a.pts.length > 8 && <Tag color={t.tx3}>+{a.pts.length - 8}</Tag>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Btn t={t} onClick={() => onPick("analysis", analyses.find((a) => a.name === selectedAnalysis))}
          disabled={!selectedAnalysis} style={{ flex: 1 }}>
          Confirm
        </Btn>
        <Btn t={t} onClick={() => { setStep("choose"); setSelectedAnalysis(null); }} style={{ flex: 1 }}>
          Back
        </Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: t.tx, marginBottom: 4 }}>
        Step 3 · Choose Template
      </div>
      <div style={{ fontSize: 13, color: t.tx2, marginBottom: 20 }}>
        How do you want to set up this analysis session?
      </div>

      <input ref={templateRef} type="file" accept=".cepht" style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const d = JSON.parse(ev.target.result);
              if (d.format === "cepht" || d.markups) onPick("upload", null, d);
              else notify("This is not a valid .cepht template file.", { tone: "err" });
            } catch (e) { notify("Cannot parse file: " + e.message, { tone: "err" }); }
          };
          reader.readAsText(file);
          e.target.value = "";
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        {options.map((opt) => (
          <div key={opt.id} onClick={() => {
            if (opt.id === "upload") { templateRef.current?.click(); return; }
            if (opt.id === "analysis") {
              if (analyses.length === 0) { onPick("blank"); return; }
              setStep("analysis"); return;
            }
            if (opt.id === "complete") {
              const template = projection === "ap" ? analyses.find((a) => a.name === "General PA Analysis") || analyses[0]
                : projection === "lateral" ? analyses.find((a) => a.name === "General Ceph Analysis") || analyses[0]
                : analyses[0];
              if (template) onPick("complete", template); else onPick("blank");
              return;
            }
            onPick(opt.id);
          }}
            style={{
              padding: "14px 16px", border: `1px solid ${t.bdr}`, borderRadius: 10,
              cursor: "pointer", background: t.surf2, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.acc; e.currentTarget.style.background = t.accMuted; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bdr; e.currentTarget.style.background = t.surf2; }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.tx, marginBottom: 4 }}>{opt.title}</div>
            <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>{opt.desc}</div>
          </div>
        ))}
      </div>
      <Btn t={t} onClick={() => onPick("cancel")} style={{ width: "100%", marginTop: 4 }}>Cancel</Btn>
    </div>
  );
}

function buildImgEntry(imageData) {
  return imageData ? {
    id: Math.random().toString(36).slice(2, 10),
    name: imageData.file.name,
    dataUrl: imageData.dataUrl,
    dx: 0, dy: 0, opacity: 1, blendMode: "normal",
    visible: true, color: "none",
    transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
  } : null;
}

function buildCalib(result) {
  return result ? { done: true, pxPerMm: result.pxPerMm, knownMm: result.knownMm } : { done: false, pxPerMm: 1, knownMm: "" };
}

function buildResult(name, imageData, calib, type, analysis, templateData, imageName) {
  return {
    name: imageName || "Untitled Case",
    image: buildImgEntry(imageData),
    calibration: buildCalib(calib),
    templateType: type,
    analysis,
    templateData,
  };
}

export default function StartupWizard({ t, projection, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [calib, setCalib] = useState(null);
  const [imageName, setImageName] = useState("");
  const [subProjection, setSubProjection] = useState(null);
  const [guideKey, setGuideKey] = useState(null);

  const isOther = projection === "other";
  const stepLabels = isOther ? ["Projection", "Image", "Calibrate"] : ["Image", "Calibrate", "Template"];

  const handlePickProjection = (name, analysis) => {
    if (!name) { onCancel(); return; }
    setSubProjection({ name, analysis });
    setStep(1);
  };

  const handleImage = (data) => {
    setImageData(data);
    if (data) setImageName(data.file.name.replace(/\.[^.]+$/, ""));
  };

  const handleCalibrate = (result) => {
    setCalib(result);
    if (isOther) {
      const type = subProjection?.analysis ? "complete" : "blank";
      onComplete(buildResult(imageName, imageData, result || { pxPerMm: 1, knownMm: "" }, type, subProjection?.analysis || null, null, imageName));
    } else {
      if (result) setStep(2);
      else { setStep(2); setCalib({ pxPerMm: 1, knownMm: "" }); }
    }
  };

  const handlePick = (type, analysis, templateData) => {
    if (type === "cancel") { onCancel(); return; }
    onComplete(buildResult(imageName, imageData, calib, type, analysis, templateData, imageName));
  };

  return (
    <div style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 14, padding: 28, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
      <StepDots current={step} total={3} t={t} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={step > 0 ? () => setStep(step - 1) : onCancel}
          style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 14, padding: 4 }}>
          {step > 0 ? "← Back" : "← Cancel"}
        </button>
        {stepLabels[step] && <span style={{ fontSize: 11, color: t.tx3, fontWeight: 600 }}>{step + 1} of 3 · {stepLabels[step]}</span>}
        <GuideBtn t={t} onClick={() => setGuideKey("startup")} />
      </div>

      {isOther ? (
        <>
          {step === 0 && <StepPickProjection t={t} onPick={handlePickProjection}/>}
          {step === 1 && <StepImage t={t} initialPreview={imageData?.dataUrl} onImage={handleImage} onNext={() => imageData && setStep(2)}/>}
          {step === 2 && imageData && (
            <StepCalibrate t={t} imageDataUrl={imageData.dataUrl} onCalibrate={handleCalibrate}/>
          )}
        </>
      ) : (
        <>
          {step === 0 && <StepImage t={t} initialPreview={imageData?.dataUrl} onImage={handleImage} onNext={() => imageData && setStep(1)}/>}
          {step === 1 && imageData && (
            <StepCalibrate t={t} imageDataUrl={imageData.dataUrl} onCalibrate={handleCalibrate}/>
          )}
          {step === 2 && <StepTemplate t={t} projection={projection} onPick={handlePick}/>}
        </>
      )}

      <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${t.bdr}`,display:"flex",justifyContent:"center"}}>
        <button onClick={()=>onComplete({name:"Untitled Case",image:null,calibration:{done:false,pxPerMm:1,knownMm:""},templateType:"blank",analysis:null,templateData:null})}
          style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:12,padding:"6px 12px",borderRadius:6,transition:"all 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.color=t.tx2;e.currentTarget.style.background=t.surf3;}}
          onMouseLeave={e=>{e.currentTarget.style.color=t.tx3;e.currentTarget.style.background="transparent";}}
        >
          Skip all steps — start with an empty canvas
        </button>
      </div>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
