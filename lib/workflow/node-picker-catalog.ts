import type { AddableWorkflowNodeType } from "@/types/workflow-canvas";

export type PickerNodeAction =
  | { kind: "addable"; type: AddableWorkflowNodeType }
  | { kind: "demo" };

export type PickerOption = {
  id: string;
  label: string;
  keywords: string[];
  action: PickerNodeAction;
};

export type PickerSubcategory = {
  id: string;
  label: string;
  options: PickerOption[];
};

export type PickerCategory = {
  id: string;
  label: string;
  subcategories: PickerSubcategory[];
};

function demoOption(id: string, label: string, extraKeywords: string[] = []): PickerOption {
  return {
    id,
    label,
    keywords: [label, ...extraKeywords].map((value) => value.toLowerCase()),
    action: { kind: "demo" },
  };
}

function addableOption(
  id: string,
  label: string,
  type: AddableWorkflowNodeType,
  extraKeywords: string[] = [],
): PickerOption {
  return {
    id,
    label,
    keywords: [label, type, ...extraKeywords].map((value) => value.toLowerCase()),
    action: { kind: "addable", type },
  };
}

export const NODE_PICKER_CATALOG: PickerCategory[] = [
  {
    id: "image",
    label: "IMAGE",
    subcategories: [
      {
        id: "generate-image",
        label: "Generate Image",
        options: [
          demoOption("flux-2-max", "FLUX 2 Max", ["flux", "image"]),
          demoOption("nano-banana-2", "Nano Banana 2", ["nano", "banana"]),
          demoOption("nano-banana-pro", "Nano Banana Pro", ["nano", "banana"]),
          demoOption("grok-imagine-image", "Grok Imagine Image", ["grok"]),
          demoOption("gpt-image-2", "GPT Image 2", ["gpt", "openai"]),
        ],
      },
      {
        id: "edit-image",
        label: "Edit Image",
        options: [
          demoOption("image-bg-remover", "Image Background Remover", ["background"]),
          demoOption("image-face-swap", "Image Face Swap", ["face"]),
          demoOption("topaz-upscale", "Topaz Upscale", ["upscale"]),
        ],
      },
      {
        id: "3d",
        label: "3D",
        options: [demoOption("meshy-v6", "Meshy V6 Preview", ["meshy", "3d"])],
      },
    ],
  },
  {
    id: "video",
    label: "VIDEO",
    subcategories: [
      {
        id: "generate-video",
        label: "Generate Video",
        options: [
          demoOption("sora-2", "Sora 2", ["sora"]),
          demoOption("veo-3-1", "VEO 3.1", ["veo"]),
          demoOption("seedance-2", "Seedance 2.0", ["seedance"]),
          demoOption("seedance-2-fast", "Seedance 2.0 Fast", ["seedance"]),
          demoOption("seedance-2-ref", "Seedance 2.0 Reference", ["seedance"]),
          demoOption("seedance-2-fast-ref", "Seedance 2.0 Fast Reference", ["seedance"]),
          demoOption("veed-fabric-lipsync", "VEED Fabric Lipsync", ["veed", "lipsync"]),
          demoOption("grok-imagine-video", "Grok Imagine Video", ["grok"]),
          demoOption("happy-horse", "Happy Horse", ["horse"]),
          demoOption("happy-horse-ref", "Happy Horse Reference", ["horse"]),
          demoOption("kling-v3-pro", "Kling v3 Pro", ["kling"]),
          demoOption("sora-2-pro", "Sora 2 Pro", ["sora"]),
          demoOption("infinitalk-video", "Infinitalk Video", ["infinitalk"]),
          demoOption("hedra-lipsync", "Hedra Lipsync", ["hedra", "lipsync"]),
        ],
      },
      {
        id: "enhance-video",
        label: "Enhance Video",
        options: [
          demoOption("video-bg-changer", "Video Background Changer", ["background"]),
          demoOption("xiangx-faceswap", "Xiangx Video Faceswap", ["faceswap"]),
          demoOption("video-faceswap", "Video Faceswap", ["faceswap"]),
          demoOption("video-watermark-remover", "Video Watermark Remover", ["watermark"]),
          demoOption("video-upscaler", "Video Upscaler", ["upscale"]),
          demoOption("kling-v3-motion", "Kling V3 Pro Motion Control", ["kling", "motion"]),
          demoOption("sora-2-edit", "Sora 2 Edit Video", ["sora", "edit"]),
          demoOption("sora-2-extend", "Sora 2 Extend Video", ["sora", "extend"]),
        ],
      },
      {
        id: "bg-remover",
        label: "BG Remover",
        options: [
          demoOption("video-bg-green", "Video BG Remover (Green Screen)", ["green screen"]),
          demoOption("video-bg-transparent", "Video BG Remover (Transparent)", ["transparent"]),
          demoOption("veed-fast-bg", "VEED Fast Video BG Remover", ["veed"]),
          demoOption("veed-bg", "VEED Video BG Remover", ["veed"]),
        ],
      },
    ],
  },
  {
    id: "audio",
    label: "AUDIO",
    subcategories: [
      {
        id: "text-to-speech",
        label: "Text to Speech",
        options: [
          demoOption("elevenlabs-v3", "ElevenLabs V3", ["elevenlabs", "tts"]),
          demoOption("elevenlabs-multilingual", "ElevenLabs Multilingual V2", ["elevenlabs"]),
          demoOption("openai-tts", "OpenAI TTS", ["openai"]),
          demoOption("minimax-tts", "MiniMax TTS", ["minimax"]),
          demoOption("gemini-pro-tts", "Gemini Pro TTS", ["gemini", "tts"]),
        ],
      },
      {
        id: "music-generation",
        label: "Music Generation",
        options: [
          demoOption("eleven-music", "Eleven Music", ["elevenlabs"]),
          demoOption("lyria-3-pro", "Lyria 3 Pro", ["lyria"]),
        ],
      },
      {
        id: "sound-effects",
        label: "Sound Effects",
        options: [
          demoOption("eleven-sfx", "ElevenLabs Sound Effects", ["elevenlabs"]),
          demoOption("cassette-sfx", "CassetteAI Sound Effects", ["cassette"]),
        ],
      },
      {
        id: "other-audio",
        label: "Other Audio Tools",
        options: [
          demoOption("eleven-isolation", "ElevenLabs Audio Isolation", ["elevenlabs"]),
          demoOption("eleven-voice-changer", "ElevenLabs Voice Changer", ["elevenlabs"]),
          demoOption("ai-transcription", "AI Transcription", ["transcription"]),
          demoOption("eleven-translation", "ElevenLabs Audio Translation", ["elevenlabs"]),
          demoOption("stem-splitter", "Stem Splitter", ["stem"]),
          demoOption("audio-visual-separate", "Audio Visual Separate", ["separate"]),
          demoOption("audio-span-separate", "Audio Span Separate", ["separate"]),
          demoOption("audio-separate", "Audio Separate", ["separate"]),
          demoOption("podcast-summarizer", "Podcast Summarizer", ["podcast"]),
        ],
      },
    ],
  },
  {
    id: "others",
    label: "OTHERS",
    subcategories: [
      {
        id: "input",
        label: "Input",
        options: [
          demoOption("text-input", "Text Input", ["text", "input"]),
          demoOption("image-input", "Image Input", ["image", "input"]),
          demoOption("audio-input", "Audio Input", ["audio", "input"]),
          demoOption("video-input", "Video Input", ["video", "input"]),
          demoOption("file-input", "File Input", ["file", "input"]),
        ],
      },
      {
        id: "utility",
        label: "Utility",
        options: [
          addableOption("crop-image", "Crop Image", "cropImage", ["crop", "utility"]),
          demoOption("merge-audio-video", "Merge Audio & Video", ["merge"]),
          demoOption("merge-videos", "Merge Videos", ["merge"]),
          demoOption("extract-audio", "Extract Audio", ["extract"]),
          demoOption("text-selector", "Text Selector", ["text"]),
          demoOption("text-concatenator", "Text Concatenator", ["text"]),
          demoOption("image-router", "Image Router", ["router", "image"]),
          demoOption("audio-router", "Audio Router", ["router", "audio"]),
          demoOption("video-router", "Video Router", ["router", "video"]),
          demoOption("text-router", "Text Router", ["router", "text"]),
        ],
      },
      {
        id: "llm-call",
        label: "LLM Call",
        options: [
          demoOption("gpt-5-4-nano", "GPT 5.4 Nano", ["gpt", "openai"]),
          demoOption("gpt-5-4-mini", "GPT 5.4 Mini", ["gpt", "openai"]),
          demoOption("gpt-5-4", "GPT 5.4", ["gpt", "openai"]),
          addableOption("gemini-3-1-pro", "Gemini 3.1 Pro", "geminiPro", [
            "gemini",
            "llm",
            "pro",
          ]),
          demoOption("claude-sonnet-4-6", "Claude Sonnet 4.6", ["claude", "anthropic"]),
          demoOption("claude-opus-4-6", "Claude Opus 4.6", ["claude", "anthropic"]),
          demoOption("claude-opus-4-8", "Claude Opus 4.8", ["claude", "anthropic"]),
          demoOption("gemini-3-1-flash-lite", "Gemini 3.1 Flash Lite", ["gemini"]),
          demoOption("deepseek-v3-2", "DeepSeek V3.2", ["deepseek"]),
          demoOption("grok-4-3", "Grok 4.3", ["grok"]),
        ],
      },
    ],
  },
];

export type PickerSearchMatch = {
  category: PickerCategory;
  subcategory: PickerSubcategory;
  option: PickerOption;
};

function optionMatchesQuery(option: PickerOption, query: string): boolean {
  if (!query) {
    return true;
  }

  return option.keywords.some((keyword) => keyword.includes(query));
}

function filterSubcategoryOptions(
  subcategory: PickerSubcategory,
  query: string,
): PickerOption[] {
  if (!query) {
    return subcategory.options;
  }

  const normalized = query.trim().toLowerCase();

  if (subcategory.label.toLowerCase().includes(normalized)) {
    return subcategory.options;
  }

  return subcategory.options.filter((option) =>
    optionMatchesQuery(option, normalized),
  );
}

export type PickerSubcategoryKey = `${string}:${string}`;

export function getSubcategoryKey(
  categoryId: string,
  subcategoryId: string,
): PickerSubcategoryKey {
  return `${categoryId}:${subcategoryId}`;
}

export function getDefaultSubcategoryKey(
  categories: PickerCategory[] = NODE_PICKER_CATALOG,
): PickerSubcategoryKey {
  const category = categories[0] ?? NODE_PICKER_CATALOG[0];
  const subcategory = category?.subcategories[0];

  return getSubcategoryKey(
    category?.id ?? "image",
    subcategory?.id ?? "generate-image",
  );
}

export function findSubcategoryByKey(
  categories: PickerCategory[],
  key: PickerSubcategoryKey,
): { category: PickerCategory; subcategory: PickerSubcategory } | null {
  const [categoryId, subcategoryId] = key.split(":");

  const category = categories.find((entry) => entry.id === categoryId);

  if (!category) {
    return null;
  }

  const subcategory = category.subcategories.find(
    (entry) => entry.id === subcategoryId,
  );

  if (!subcategory) {
    return null;
  }

  return { category, subcategory };
}

export function getFirstSubcategoryKey(
  categories: PickerCategory[],
): PickerSubcategoryKey | null {
  for (const category of categories) {
    const subcategory = category.subcategories[0];

    if (subcategory) {
      return getSubcategoryKey(category.id, subcategory.id);
    }
  }

  return null;
}

export function filterPickerCatalog(
  catalog: PickerCategory[],
  query: string,
): {
  categories: PickerCategory[];
  searchMatches: PickerSearchMatch[];
} {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return { categories: catalog, searchMatches: [] };
  }

  const searchMatches: PickerSearchMatch[] = [];
  const categories: PickerCategory[] = [];

  for (const category of catalog) {
    const subcategories: PickerSubcategory[] = [];

    for (const subcategory of category.subcategories) {
      const options = filterSubcategoryOptions(subcategory, normalized);

      for (const option of options) {
        searchMatches.push({ category, subcategory, option });
      }

      if (options.length > 0) {
        subcategories.push({ ...subcategory, options });
      }
    }

    if (subcategories.length > 0) {
      categories.push({ ...category, subcategories });
    }
  }

  return { categories, searchMatches };
}

/** @deprecated Use getDefaultSubcategoryKey instead. */
export function getDefaultPickerCategoryId(categories: PickerCategory[]): string {
  return categories[0]?.id ?? NODE_PICKER_CATALOG[0]?.id ?? "image";
}
