export function extractPreview(node: HTMLElement): string {
  const text = node.innerText.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function flashTarget(node: HTMLElement): void {
  const original = node.style.boxShadow;
  node.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.6)";
  setTimeout(() => {
    node.style.boxShadow = original;
  }, 1200);
}
