declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";
  export default function TerminalRenderer(options?: Record<string, unknown>): MarkedExtension;
}
