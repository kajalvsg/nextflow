import sharp from "sharp";

export type CropImageInput = {
  input_image?: string | null;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
};

export type CropImageOutput = {
  output_image: string;
  width: number;
  height: number;
};

const MIN_CROP_DURATION_MS = 30_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeCropImage(
  input: CropImageInput,
): Promise<CropImageOutput> {
  const startedAt = Date.now();

  if (!input.input_image) {
    throw new Error("Crop Image requires a connected input image.");
  }

  const response = await fetch(input.input_image);

  if (!response.ok) {
    throw new Error(`Unable to fetch input image (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions.");
  }

  const xPercent = input.xPercent ?? 0;
  const yPercent = input.yPercent ?? 0;
  const widthPercent = input.widthPercent ?? 100;
  const heightPercent = input.heightPercent ?? 100;

  const left = Math.round((metadata.width * xPercent) / 100);
  const top = Math.round((metadata.height * yPercent) / 100);
  const width = Math.max(
    1,
    Math.round((metadata.width * widthPercent) / 100),
  );
  const height = Math.max(
    1,
    Math.round((metadata.height * heightPercent) / 100),
  );

  const cropped = await image
    .extract({
      left: Math.min(left, metadata.width - 1),
      top: Math.min(top, metadata.height - 1),
      width: Math.min(width, metadata.width - left),
      height: Math.min(height, metadata.height - top),
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  const elapsed = Date.now() - startedAt;
  const remaining = MIN_CROP_DURATION_MS - elapsed;

  if (remaining > 0) {
    await wait(remaining);
  }

  const output_image = `data:image/jpeg;base64,${cropped.toString("base64")}`;

  return {
    output_image,
    width,
    height,
  };
}
