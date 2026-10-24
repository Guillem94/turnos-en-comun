import React, { useEffect, useRef } from "react";
export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    const previousFocus = document.activeElement;
    el.showModal();
    const cancel = (e) => {
      // File inputs also emit a bubbling cancel when selection is unchanged.
      if (e.target !== el) return;
      e.preventDefault();
      onClose?.();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby="dialog-title"
    >
      <header className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        {onClose && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar diálogo"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>
      {children}
    </dialog>
  );
}
