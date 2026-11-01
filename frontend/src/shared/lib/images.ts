/** Downscales photos to at most `max` px on the long side before upload. */
export async function compressImage(file: File, max = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  const context = canvas.getContext("2d");
  if (context) {
    // JPEG has no alpha: without a background, transparent areas (screenshots, diagrams) come out black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/jpeg", quality);
  });
}
