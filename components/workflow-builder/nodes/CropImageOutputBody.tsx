"use client";

import {
  getCropOutputImage,
  getCropOutputUrl,
} from "./crop-output-utils";

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

type CropImageOutputBodyProps = {
  output: unknown;
};

export function CropImageOutputBody({ output }: CropImageOutputBodyProps) {
  const cropOutput = getCropOutputImage(output);
  const outputUrl = getCropOutputUrl(output);

  if (!cropOutput || !outputUrl) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No cropped image was returned.
      </p>
    );
  }

  const sizeLabel =
    cropOutput.width != null && cropOutput.height != null
      ? `${cropOutput.width} × ${cropOutput.height}px`
      : null;

  return (
    <div className="stack-sm">
      <div className="workflow-node-upload-preview">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="truncate text-[10px] text-muted-foreground">
            Cropped image
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cropOutput.src}
          alt="Cropped output"
          className="max-h-24 w-full rounded-md object-cover"
        />
      </div>

      <input
        type="text"
        readOnly
        value={outputUrl}
        title={outputUrl}
        aria-label="Cropped image URL"
        onPointerDown={stopNodePointer}
        className="workflow-node-prompt-field w-full px-2 py-1.5 text-[11px]"
      />
    </div>
  );
}
