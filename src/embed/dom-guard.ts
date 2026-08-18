function nativeNode(): typeof Node | null {
  const frame = document.createElement("iframe");
  frame.style.cssText = "display:none;position:absolute;width:0;height:0;border:0";
  document.documentElement.appendChild(frame);
  const node = (frame.contentWindow as (Window & { Node: typeof Node }) | null)?.Node ?? null;
  frame.remove();
  return node;
}

export function installDomGuards(): void {
  const native = nativeNode();
  if (!native) return;

  const insertBefore = native.prototype.insertBefore;
  const removeChild = native.prototype.removeChild;
  const appendChild = native.prototype.appendChild;

  const safeInsertBefore: typeof Node.prototype.insertBefore = function (this: Node, newNode, refNode) {
    const reference = refNode && (refNode as Node).parentNode === this ? refNode : null;
    try {
      return insertBefore.call(this, newNode, reference);
    } catch {
      return appendChild.call(this, newNode);
    }
  };

  const safeRemoveChild: typeof Node.prototype.removeChild = function (this: Node, child) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  };

  Node.prototype.insertBefore = safeInsertBefore;
  Node.prototype.removeChild = safeRemoveChild;
}

export function keepDomGuards(): void {
  installDomGuards();
  document.addEventListener("DOMContentLoaded", installDomGuards);
  window.addEventListener("load", installDomGuards);
  [50, 250, 1000, 2500].forEach((ms) => window.setTimeout(installDomGuards, ms));
}
