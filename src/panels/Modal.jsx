import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { BACKDROP } from "../ui/tokens.js";

// Focus, Tab trap and Escape come from useDialogA11y, shared with the app's
// other dialogs so nested dialogs close one at a time.
export function Modal({t,title,children,onClose,wide,customWidth}){
  const contentRef=useDialogA11y(onClose);
  return(
    <div role="dialog" aria-modal="true" aria-label={title} style={{position:"fixed",inset:0,background:BACKDROP,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={contentRef} style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,width:customWidth||(wide?900:420),maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 24px 60px rgba(0,0,0,0.4)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:t.tx}}>{title}</div>
          <button onClick={onClose} title="Close" aria-label="Close" style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// The same look as Modal for dialogs that lay out their own body (a fixed
// header, a scrolling area, a footer): overlay, panel and header only.
// `title` may hold extra inline content (a guide button); `extra` sits before ×.
export function DialogShell({ t, dialogRef, label, title, extra, onClose, width = 420, zIndex = 100, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{ position: "fixed", inset: 0, background: BACKDROP, display: "flex", alignItems: "center", justifyContent: "center", zIndex, padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 12, width, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px 12px", flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: t.tx, flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{title}</div>
          {extra}
          <button onClick={onClose} title="Close" aria-label="Close" style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
