declare module 'gifshot' {
  export interface CreateGifOptions {
    images?: Array<string | HTMLCanvasElement | HTMLImageElement>;
    gifWidth?: number;
    gifHeight?: number;
    numFrames?: number;
    frameDuration?: number; // duration in 10ths of a second
    sampleInterval?: number;
    numWorkers?: number;
    [key: string]: any;
  }

  export interface CreateGifResult {
    error: boolean;
    errorCode?: string;
    errorMsg?: string;
    image: string; // base64 data url
  }

  export function createGIF(
    options: CreateGifOptions,
    callback: (obj: CreateGifResult) => void
  ): void;
}

declare module 'gifuct-js' {
  export interface GifFrame {
    patch: Uint8ClampedArray;
    dims: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
    delay: number;
    disposalType: number;
  }

  export interface ParsedGif {
    frames: any[];
    [key: string]: any;
  }

  export function parseGIF(buffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(gif: ParsedGif, buildPatch: boolean): GifFrame[];
}
