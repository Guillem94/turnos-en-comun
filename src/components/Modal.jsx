import React, { useEffect, useRef } from "react";
export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const cancel = (e) => {
      e.preventDefault();
      onClose?.();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
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
