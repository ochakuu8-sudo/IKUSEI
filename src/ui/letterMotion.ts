/** Paper coordinates stay relative to the responsive stage, including after a resize. */
export type PaperOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type PaperMotion = { cancel: () => void; finish: () => void };

export function capturePaper(
  element: HTMLElement,
  stage: HTMLElement,
): PaperOrigin | null {
  const paper = element.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  if (!frame.width || !frame.height) return null;
  return {
    x: (paper.left - frame.left) / frame.width,
    y: (paper.top - frame.top) / frame.height,
    width: paper.width / frame.width,
    height: paper.height / frame.height,
  };
}

export function animatePaper(
  element: HTMLElement,
  stage: HTMLElement,
  origin: PaperOrigin | null,
  direction: "open" | "close",
  reduced: boolean,
  onFinish: () => void = () => {},
  currentTransform?: string,
): PaperMotion {
  if (reduced || !origin || typeof element.animate !== "function") {
    onFinish();
    return { cancel() {}, finish() {} };
  }
  const previousOrigin = element.style.transformOrigin;
  const previousAnimation = element.style.animation;
  element.style.animation = "none";
  const paper = element.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  const scaleX = frame.width / stage.offsetWidth;
  const scaleY = frame.height / stage.offsetHeight;
  if (!paper.width || !paper.height || !scaleX || !scaleY) {
    element.style.animation = previousAnimation;
    onFinish();
    return { cancel() {}, finish() {} };
  }
  const dx =
    (frame.left +
      (origin.x + origin.width / 2) * frame.width -
      (paper.left + paper.width / 2)) /
    scaleX;
  const dy =
    (frame.top +
      (origin.y + origin.height / 2) * frame.height -
      (paper.top + paper.height / 2)) /
    scaleY;
  const sx = (origin.width * frame.width) / paper.width;
  const sy = (origin.height * frame.height) / paper.height;
  const folded = `translate(${dx}px, ${dy}px) scale(${Math.min(sx, sy)})`;
  element.dataset.paperMotion = direction;
  element.style.transformOrigin = "center";
  const animation = element.animate(
    direction === "open"
      ? [{ transform: folded }, { transform: "none" }]
      : [{ transform: currentTransform || "none" }, { transform: folded }],
    {
      duration: direction === "open" ? 300 : 240,
      easing:
        direction === "open"
          ? "cubic-bezier(.2,.8,.25,1)"
          : "cubic-bezier(.4,0,.65,1)",
      fill: "both",
    },
  );
  let active = true;
  const clean = () => {
    if (!active) return false;
    active = false;
    animation.onfinish = null;
    animation.cancel();
    element.style.transformOrigin = previousOrigin;
    element.style.animation = previousAnimation;
    delete element.dataset.paperMotion;
    return true;
  };
  animation.onfinish = () => {
    if (clean()) onFinish();
  };
  return {
    cancel: () => {
      clean();
    },
    finish: () => {
      if (clean()) onFinish();
    },
  };
}
