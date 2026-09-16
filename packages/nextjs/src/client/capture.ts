// Browser capture helpers: turn a clicked DOM node into rich "where" context
// so the user never has to describe location. Called only client-side.
import type { ElementContext, Intent, ReportBundle, Severity } from "@loopix/core";

// Build a stable-ish CSS selector path from the element up to <body>.
function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "body") {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part += `#${node.id}`;
      parts.unshift(part);
      break;
    }
    const cls = Array.from(node.classList).slice(0, 2).join(".");
    if (cls) part += `.${cls}`;
    const parent = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

// Walk the React fiber from a DOM node to collect nearest component names.
function reactComponentStack(el: Element, max = 6): string[] {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  if (!key) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber: any = (el as any)[key];
  const names: string[] = [];
  while (fiber && names.length < max) {
    const t = fiber.type;
    let name: string | null = null;
    if (typeof t === "function") name = t.displayName || t.name || null;
    else if (t && typeof t === "object") name = t.displayName || t.name || null;
    if (name && name !== names[names.length - 1]) names.push(name);
    fiber = fiber.return;
  }
  return names;
}

export function describeElement(el: Element): ElementContext {
  const rect = el.getBoundingClientRect();
  const dataset: Record<string, string> = {};
  if (el instanceof HTMLElement) {
    for (const [k, v] of Object.entries(el.dataset)) {
      if (v != null) dataset[k] = v;
    }
  }
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  return {
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    text: text || null,
    dataset,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
    componentStack: reactComponentStack(el),
    route: typeof location !== "undefined" ? location.pathname : "",
  };
}

// Client-safe copy so client components never value-import @loopix/core (whose
// barrel pulls in FileReportStore → node:fs, which can't go in a browser bundle).
export function whereLabel(ctx: ElementContext): string {
  const comp = ctx.componentStack[0];
  const snippet = ctx.text
    ? `“${ctx.text.slice(0, 40)}${ctx.text.length > 40 ? "…" : ""}”`
    : null;
  if (comp && snippet) return `${snippet} in ${comp}`;
  if (comp) return `<${ctx.tag}> in ${comp}`;
  if (snippet) return `<${ctx.tag}> ${snippet}`;
  return `<${ctx.tag}>`;
}

export function buildReport(
  context: ElementContext,
  fields: { message: string | null; severity: Severity | null; intent?: Intent },
): ReportBundle {
  return {
    schema: "1.0",
    kind: "user_report",
    ts: new Date().toISOString(),
    report: fields,
    context,
    page: {
      url: typeof location !== "undefined" ? location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
    },
    buffer: null,
  };
}
