/**
 * 画面の土台。全画面キャンバスの上に出す器と、失敗しても崩れない画像。
 * ここは 1200×500 の外側（`<dialog>` は top layer に出るので `--fit` を自分でかける）。
 */
import { Flower2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Button({
  children,
  onClick,
  disabled,
  primary,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      className={`button ${primary ? "primary" : ""} ${className}`}
      disabled={disabled}
      onClick={(e) => {
        e.currentTarget.focus();
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
export function Art({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div
      className={`art-fallback ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <Flower2 aria-hidden="true" />
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
export function Modal({
  title,
  children,
  onClose,
  footer,
  variant = "window",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  variant?: "window" | "scenario" | "result";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`dialog ${variant === "scenario" ? "scenario-dialog" : ""} ${variant === "result" ? "result-dialog" : ""}`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const elements = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href],summary,[tabindex]",
          ),
        ].filter(
          (el) =>
            !el.matches(":disabled") &&
            el.tabIndex >= 0 &&
            el.getClientRects().length > 0,
        );
        if (!elements.length) {
          e.preventDefault();
          return;
        }
        const i = elements.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          elements.at(-1)!.focus();
        } else if (!e.shiftKey && (i < 0 || i === elements.length - 1)) {
          e.preventDefault();
          elements[0].focus();
        }
      }}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
    >
      {variant !== "scenario" && (
        <header>
          <h2>{title}</h2>
          {variant === "window" && (
            <Button aria-label="閉じる" onClick={onClose}>
              <X size={20} />
            </Button>
          )}
        </header>
      )}
      <div className="dialog-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>,
    document.body,
  );
}
