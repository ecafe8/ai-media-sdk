import { describe, expect, test } from "bun:test";
import {
  ALIYUN_MODEL_REGISTRY,
  aliyunModelRegistry,
} from "@ai-media/provider-aliyun-bailian";

describe("Aliyun audio registry", () => {
  test("projects audio families without changing image and video modalities", () => {
    const byId = new Map(
      aliyunModelRegistry.models.map((model) => [model.id, model])
    );
    expect(byId.get("cosyvoice-v3.5-flash")?.modality).toBe("audio");
    expect(byId.get("qwen3-tts-flash")?.modality).toBe("audio");
    expect(byId.get("MiniMax/speech-2.8-hd")?.modality).toBe("audio");
    expect(byId.get("qwen-image-3.0")?.modality).toBe("image");
    expect(byId.get("wan3.0-video")?.modality).toBe("video");
  });

  test("keeps family metadata isolated", () => {
    expect(ALIYUN_MODEL_REGISTRY["cosyvoice-v3.5-flash"]?.audio).toMatchObject({
      supportsSsml: true,
      instructionField: "instruction",
    });
    expect(ALIYUN_MODEL_REGISTRY["qwen3-tts-flash"]?.audio).toMatchObject({
      instructionField: "instructions",
    });
    expect(ALIYUN_MODEL_REGISTRY["MiniMax/speech-2.8-hd"]?.audio).toMatchObject(
      {
        supportedFormats: ["mp3", "wav", "pcm"],
      }
    );
    expect(
      ALIYUN_MODEL_REGISTRY["qwen3-tts-flash"]?.audio?.supportsSsml
    ).toBeUndefined();
  });
});
