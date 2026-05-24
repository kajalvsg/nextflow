import { task } from "@trigger.dev/sdk/v3";
import {
  executeCropImage,
  type CropImageInput,
} from "@/lib/workflow/execution/crop-image";

export type CropImageTaskPayload = {
  input: CropImageInput;
};

export const cropImageTask = task({
  id: "crop-image",
  run: async (payload: CropImageTaskPayload) => {
    const output = await executeCropImage(payload.input);

    return {
      output_image: output.output_image,
      width: output.width,
      height: output.height,
    };
  },
});
