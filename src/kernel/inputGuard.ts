// Determines whether the user is currently typing into some
// editable surface — an <input>, <textarea>, or Xterm's own
// hidden textarea that it uses to capture keyboard input.
//
// Global shortcuts should generally NOT fire while this returns
// true, with the exception of shortcuts that use a modifier
// combination no legitimate text input would ever rely on.
export function isTypingContext(): boolean {
  const el = document.activeElement;

  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;

  if ((el as HTMLElement).isContentEditable) return true;

  // Xterm.js renders a hidden <textarea> internally to capture
  // keystrokes — its class name includes "xterm-helper-textarea"
  if (el.classList?.contains("xterm-helper-textarea")) return true;

  return false;
}
