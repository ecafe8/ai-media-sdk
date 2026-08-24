import type { AudioContent } from "./content.ts";

export interface AudioWordTimestamp {
  readonly text: string;
  readonly beginIndex?: number;
  readonly endIndex?: number;
  readonly beginTime?: number;
  readonly endTime?: number;
}

export type AudioStreamEvent =
  | {
      readonly type: "sentence-begin";
      readonly index?: number;
      readonly text?: string;
    }
  | {
      readonly type: "sentence-synthesis";
      readonly audio: AudioContent;
      readonly index?: number;
    }
  | {
      readonly type: "sentence-end";
      readonly index?: number;
      readonly text?: string;
      readonly words?: readonly AudioWordTimestamp[];
    }
  | { readonly type: "complete"; readonly audio?: AudioContent }
  | {
      readonly type: "error";
      readonly code: string;
      readonly message: string;
    };
