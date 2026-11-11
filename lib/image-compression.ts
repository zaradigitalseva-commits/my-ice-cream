export type ImageCompressionOptions = {
  maxDimension?: number;
  maxBytes?: number;
  initialQuality?: number;
  targetWidth?: number;
  targetHeight?: number;
  fit?: "contain" | "cover";
};

function loadImage(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight, cleanup: () => URL.revokeObjectURL(url) });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be opened. Please choose another photo.")); };
    image.src = url;
  });
}

/** Compresses a selected raster image to WebP in the browser before it is saved. */
export async function compressImageToWebP(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
    throw new Error("Please choose a PNG, JPG or WebP image.");
  }
  const maxBytes = options.maxBytes ?? 220 * 1024;
  const initialQuality = options.initialQuality ?? 0.82;
  const loaded = await loadImage(file);
  try {
    if (options.targetWidth && options.targetHeight) {
      const width = options.targetWidth;
      const height = options.targetHeight;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is not supported in this browser.");
      // Keep the whole product photo visible; fill unused space with a neutral background.
      context.fillStyle = "#fffaf2";
      context.fillRect(0, 0, width, height);
      const fit = options.fit ?? "contain";
      const scale = fit === "cover"
        ? Math.max(width / loaded.width, height / loaded.height)
        : Math.min(width / loaded.width, height / loaded.height);
      const drawWidth = loaded.width * scale;
      const drawHeight = loaded.height * scale;
      context.drawImage(loaded.image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);

      for (let quality = initialQuality; quality >= 0.28; quality -= 0.07) {
        const result = canvas.toDataURL("image/webp", Math.max(0.28, quality));
        if (result.length * 0.75 <= maxBytes) return result;
      }
      throw new Error("Photo 100 KB se kam compress nahi hui. Kripya doosri ya chhoti photo choose karein.");
    }

    const maxDimension = options.maxDimension ?? 1200;
    let scale = Math.min(1, maxDimension / Math.max(loaded.width, loaded.height));
    for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(loaded.width * scale));
      canvas.height = Math.max(1, Math.round(loaded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is not supported in this browser.");
      context.drawImage(loaded.image, 0, 0, canvas.width, canvas.height);
      for (let quality = initialQuality; quality >= 0.38; quality -= 0.08) {
        const result = canvas.toDataURL("image/webp", Math.max(0.38, quality));
        // A data URL is about 4/3 the size of the underlying binary image.
        if (result.length * 0.75 <= maxBytes) return result;
      }
      scale *= 0.78;
    }
    throw new Error("Image is still too large after compression. Please choose a smaller photo.");
  } finally {
    loaded.cleanup();
  }
}
