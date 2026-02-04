// Dynamic import to avoid bundling pdf.js until needed
let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function loadPdfJs() {
  if (!pdfjsLib) {
    // Import pdf.js and its worker using Vite's ?url import for proper bundling
    const [pdfjs, workerModule] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjsLib = pdfjs;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  }
  return pdfjsLib;
}

/**
 * Generate a thumbnail image from a PDF file.
 * Renders the first page of the PDF to a canvas and returns it as a Blob.
 *
 * @param file - The PDF file to generate a thumbnail from
 * @param maxWidth - Maximum width of the thumbnail (default: 400)
 * @param maxHeight - Maximum height of the thumbnail (default: 533, 3:4 aspect)
 * @returns A JPEG Blob of the thumbnail, or null if generation fails
 */
export async function generatePdfThumbnail(
  file: File,
  maxWidth = 400,
  maxHeight = 533
): Promise<Blob | null> {
  // Only run in browser (not during SSR)
  if (typeof document === "undefined") {
    return null;
  }

  try {
    const pdfjs = await loadPdfJs();

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    // Get the first page
    const page = await pdf.getPage(1);

    // Calculate scale to fit within max dimensions while maintaining aspect ratio
    const viewport = page.getViewport({ scale: 1 });
    const scaleX = maxWidth / viewport.width;
    const scaleY = maxHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledViewport = page.getViewport({ scale });

    // Create a canvas to render the page
    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Could not get canvas context");
      return null;
    }

    // Fill with white background (PDFs can have transparency)
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Render the page to the canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    // Convert canvas to JPEG blob
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.85 // Quality
      );
    });
  } catch (error) {
    console.error("Failed to generate PDF thumbnail:", error);
    return null;
  }
}

/**
 * Check if a file is a PDF based on its MIME type.
 */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf";
}
