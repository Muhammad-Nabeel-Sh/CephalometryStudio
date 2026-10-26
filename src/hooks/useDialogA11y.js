import { useEffect, useRef } from "react";

// Open dialogs, innermost last: only the top one reacts to Escape / Tab.
const stack = [];

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// C2: keyboard behaviour for a custom dialog — focus moves into it on open and
// back on close, Tab stays inside, Escape closes. Attach the returned ref to
// the dialog's content box (and give the overlay role="dialog" aria-modal).
export function useDialogA11y(onClose, { active = true } = {}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;
    const token = {};
    stack.push(token);
    const previous = document.activeElement;
    const box = ref.current;
    const first = box?.querySelector("[autofocus]") || box?.querySelector(FOCUSABLE);
    (first || box)?.focus?.();
    const onKey = e => {
      if (!ref.current || stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && closeRef.current) { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!ref.current.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      try { previous?.focus?.(); } catch { /* element gone */ }
    };
  }, [active]);

  return ref;
}
