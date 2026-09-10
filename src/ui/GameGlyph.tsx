import type { CSSProperties } from "react";
const shapes: Record<string, string> = {
 quill:'<path d="M4 21 18 4m-9 9c-3-5 4-10 11-11-1 7-5 14-11 11ZM8 17h8"/>',
 rose:'<path d="M12 3c2-3 6 0 4 3 4-1 6 4 2 6 2 4-3 7-6 4-3 3-8 0-6-4-4-2-2-7 2-6-2-3 2-6 4-3Z"/><path d="m9 8 3-2 3 3-2 4-4-2Z M12 17v6m0-2c3 0 5-2 6-4-4 0-6 1-6 4"/>',
 dignity:'<ellipse cx="12" cy="12" rx="9" ry="11"/><circle cx="12" cy="8" r="3"/><path d="M6 18c0-7 12-7 12 0H6Z"/>',
 crown:'<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Zm2 14h14"/><circle cx="12" cy="3" r="1"/>',
 talk:'<path d="M3 4h18v12H10l-5 4v-4H3V4Zm4 4h10M7 12h6"/>',
 book:'<path d="M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15M5 8l4 1m6 0 4-1M5 12l4 1m6 0 4-1"/>',
 shield:'<path d="m12 2 9 4v6c0 5-5 9-9 11-4-2-9-6-9-11V6l9-4Z"/><path d="m13 6-5 7h4l-1 5 5-8h-4l1-4Z"/>',
 charm:'<path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10ZM19 2v4m-2-2h4"/>',
 coin:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7"/><path d="m12 7 4 5-4 5-4-5 4-5Z"/>',
 energy:'<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
 growth:'<path d="M12 22V10m0 6C6 17 3 13 3 9c5-1 9 2 9 7Zm0-5c0-6 4-9 9-8 0 5-3 9-9 8Z"/>',
 bond:'<path d="M12 6H8a5 5 0 0 0 0 10h4m0-10h4a5 5 0 0 1 0 10h-4M8 11h8"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 check:'<path d="m5 12 4 4L20 5"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
 calendar:'<rect x="3" y="5" width="18" height="17" rx="1"/><path d="M7 2v6m10-6v6M3 11h18m-14 4h3m4 0h3m-10 4h3"/>',
 hourglass:'<path d="M6 2h12M6 22h12M7 2v5l10 10v5M17 2v5L7 17v5M9 18h6"/>',
 ledger:'<path d="M5 2h15v20H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM7 2v20m4-15h5m-5 4h5m-5 4h3"/>',
 gallery:'<rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8" cy="8" r="2"/><path d="m3 18 6-5 4 3 4-7 4 5"/>',
 gear:'<path d="m9 3 1-2h4l1 2 3 2 3 1v4l-2 2 2 2v4l-3 1-3 2-1 2h-4l-1-2-3-2-3-1v-4l2-2-2-2V6l3-1 3-2Z"/><circle cx="12" cy="12" r="4"/>',
 moon:'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>'
};

const aliases: Record<string,string> = { 貞操:"rose", 品位:"dignity", 威厳:"crown", negotiation:"talk", knowledge:"book", courage:"shield", charm:"charm", 体力:"energy", 関係:"bond" };
export function GameGlyph({name, label, className="", style}: {name:string;label?:string;className?:string;style?:CSSProperties}) {
 return <svg viewBox="0 0 24 24" className={"game-glyph "+className} style={style} role={label ? "img":undefined} aria-label={label} aria-hidden={label ? undefined:true}><g dangerouslySetInnerHTML={{__html:shapes[aliases[name] ?? name] ?? shapes.charm}} /></svg>;
}
