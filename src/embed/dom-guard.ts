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

  Node.prototype.insertBefore = function (this: Node, newNode, refNode) {
    const reference = refNode && (refNode as Node).parentNode === this ? refNode : null;
    try {
      return insertBefore.call(this, newNode, reference);
    } catch {
      return appendChild.call(this, newNode);
    }
  } as typeof Node.prototype.insertBefore;

  Node.prototype.removeChild = function (this: Node, child) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  } as typeof Node.prototype.removeChild;
}

export function keepDomGuards(): void {
  installDomGuards();
}
