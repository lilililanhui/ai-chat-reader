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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findNodeByText(text: string): HTMLElement | null {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!snippet) return null;

  const candidates = document.querySelectorAll(
    "[class*='questionItem-'], [class*='answerItem-']"
  );
  for (const node of candidates) {
    const nodeText = (node as HTMLElement).innerText
      .replace(/\s+/g, " ")
      .trim();
    if (nodeText.includes(snippet)) {
      return node as HTMLElement;
    }
  }
  return null;
}

export async function scrollToMessage(text: string): Promise<boolean> {
  const node = findNodeByText(text);
  if (node) {
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    flashTarget(node);
    return true;
  }

  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  await sleep(500);

  for (let i = 0; i < 5; i++) {
    const found = findNodeByText(text);
    if (found) {
      found.scrollIntoView({ behavior: "smooth", block: "center" });
      flashTarget(found);
      return true;
    }
    window.scrollBy({ top: -window.innerHeight, behavior: "smooth" });
    await sleep(500);
  }

  return false;
}
