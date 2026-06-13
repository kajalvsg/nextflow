import { cn } from "@/lib/utils/cn";

type DecorativeHandleColor =
  | "text"
  | "image"
  | "pink"
  | "green"
  | "cyan"
  | "purple";

const COLOR_CLASS: Record<DecorativeHandleColor, string> = {
  text: "workflow-decorative-handle-text",
  image: "workflow-decorative-handle-image",
  pink: "workflow-decorative-handle-pink",
  green: "workflow-decorative-handle-green",
  cyan: "workflow-decorative-handle-cyan",
  purple: "workflow-decorative-handle-purple",
};

type NodeDecorativeHandleProps = {
  color: DecorativeHandleColor;
  className?: string;
};

export function NodeDecorativeHandle({
  color,
  className,
}: NodeDecorativeHandleProps) {
  return (
    <span
      aria-hidden
      className={cn("workflow-decorative-handle", COLOR_CLASS[color], className)}
    />
  );
}
