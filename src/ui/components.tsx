import { Mark } from "../marks";
import { AlertCircle, Check, Flower2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { itemSrc } from "../art";
import { dateLabel } from "../contracts";
import type { Action } from "../engine";
import {
  axes,
  materialOf,
  recipeOf,
  type GameState,
  type MaterialId,
  type RecipeId,
} from "../game";
import { previewAction } from "../presentation";
export const money = (n: number) => `${n.toLocaleString()} G`;
export const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;
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
export function Item({
  id,
  large = false,
}: {
  id: RecipeId | MaterialId;
  large?: boolean;
}) {
  return (
    <Art src={itemSrc(id)} className={`item-art ${large ? "large" : ""}`} />
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Flower2 aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      {tone === "ready" ? (
        <Check size={13} />
      ) : tone === "warn" ? (
        <AlertCircle size={13} />
      ) : null}
      {children}
    </span>
  );
}
export function Heading({
  eyebrow,
  children,
  extra,
}: {
  eyebrow: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{children}</h1>
      </div>
      {extra}
    </div>
  );
}
export function Tabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="tabs" aria-label="表示切替">
      {options.map(([id, label]) => (
        <button
          key={id}
          aria-pressed={value === id}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Quantity({
  value,
  onChange,
  label = "数量",
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
  max?: number;
}) {
  return (
    <div className="quantity">
      <Button
        aria-label={`${label}を減らす`}
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </Button>
      <input
        aria-label={label}
        inputMode="numeric"
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(
            Math.max(0, Math.min(max, Math.trunc(Number(e.target.value)) || 0)),
          )
        }
      />
      <Button
        aria-label={`${label}を増やす`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        ＋
      </Button>
    </div>
  );
}
export function AxisPanel({ state }: { state: GameState }) {
  return (
    <div className="axis-panel">
      {axes.map((a) => (
        <div key={a}>
          <span>
            <Mark name={a} />
            {a}
          </span>
          <strong>{state.axes[a]}</strong>
          <meter min={0} max={100} value={state.axes[a]} aria-label={a} />
        </div>
      ))}
      <small>
        品位上限 <b>{state.dignityCap}</b> / 100
      </small>
    </div>
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
  variant?: "window" | "scenario";
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
      className={`dialog ${variant === "scenario" ? "scenario-dialog" : ""}`}
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
      {variant === "window" && (
        <header>
          <h2>{title}</h2>
          <Button aria-label="閉じる" onClick={onClose}>
            <X size={20} />
          </Button>
        </header>
      )}
      <div className="dialog-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>,
    document.body,
  );
}
export function Preview({
  state,
  action,
}: {
  state: GameState;
  action: Action;
}) {
  const p = previewAction(state, action);
  if (p.error)
    return (
      <p className="error" role="alert">
        {p.error}
      </p>
    );
  return (
    <div className="preview">
      <div className="stats">
        <div>
          <small>所持金の変化</small>
          <b>{sign(p.money)} G</b>
        </div>
        <div>
          <small>体力の変化</small>
          <b>{sign(p.stamina)}</b>
        </div>
        <div>
          <small>終了後</small>
          <b>{p.settlement ? "章末の精算へ" : dateLabel(p.day)}</b>
        </div>
      </div>
      <div className="cost-line">
        {p.axes.map((a) => (
          <span key={a.axis}>
            {a.axis} <b>{sign(a.delta)}</b>
          </span>
        ))}
        <span>
          品位上限 <b>{sign(p.cap)}</b>
        </span>
      </div>
      {p.stock.length > 0 && (
        <p>
          {p.stock
            .map((v) => `${recipeOf(v.id).name} ${sign(v.delta)}`)
            .join(" ／ ")}
        </p>
      )}
      {p.materials.length > 0 && (
        <p>
          {p.materials
            .map((v) => `${materialOf(v.id).name} ${sign(v.delta)}`)
            .join(" ／ ")}
        </p>
      )}
    </div>
  );
}
