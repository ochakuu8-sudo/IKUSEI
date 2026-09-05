import type { ReactNode } from "react";
import type { Action } from "../engine";
import type { GameState } from "../game";
import { actionLabel, deadlineWarnings, quoteSummary } from "../workflow";
import { previewAction } from "../presentation";
import { Button } from "./components";

export function DeadlineWarning({
  state,
  action,
}: {
  state: GameState;
  action?: Action;
}) {
  const warnings = action ? deadlineWarnings(state, action) : [];
  return warnings.length ? (
    <div className="deadline-strip" role="alert">
      <b>この行動で期限を迎える用事があります</b>
      {warnings.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </div>
  ) : null;
}
export function ActionDock({
  state,
  action,
  confirm,
  back,
  label,
  title,
  children,
  next,
}: {
  state: GameState;
  action?: Action;
  confirm: (a: Action, title: string) => void;
  back: () => void;
  label?: string;
  title?: string;
  children?: ReactNode;
  next?: { label: string; onClick: () => void };
}) {
  const error =
    action && !next ? previewAction(state, action).error : undefined;
  return (
    <div className="action-dock">
      <DeadlineWarning state={state} action={action} />
      <div className="dock-buttons">
        <Button onClick={back} aria-label="詳細から戻る">
          戻る
        </Button>
        <div className="dock-summary">
          {children}
          {action && !next && <small>{quoteSummary(state, action)}</small>}
          {error && (
            <small className="error" role="status">
              {error}
            </small>
          )}
        </div>
        {next ? (
          <Button primary onClick={next.onClick}>
            {next.label}
          </Button>
        ) : (
          action && (
            <Button
              primary
              disabled={!!error}
              onClick={() =>
                confirm(action, title ?? actionLabel(state, action))
              }
            >
              {label ?? actionLabel(state, action)}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
