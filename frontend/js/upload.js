/**
 * Image Upload & Client-Side Processing Controller
 * Handles drag-drop, file decoding validation, canvas resizing (max 1024px),
 * 64px thumbnail creation, and preview lifecycle.
 */

import { MAX_UPLOAD_MB, RESIZE_MAX_PX } from "./config.js";

export class UploadController {
  constructor({
    dropzoneEl,
    fileInputEl,
    cameraInputEl,
    previewContainerEl,
    previewImgEl,
    previewNameEl,
    previewSizeEl,
    removeBtnEl,
    replaceBtnEl,
    exampleBtnEl,
    errorEl,
    onFileSelected,
    onFileRemoved
  }) {
    this.dropzoneEl = dropzoneEl;
    this.fileInputEl = fileInputEl;
    this.cameraInputEl = cameraInputEl;
    this.previewContainerEl = previewContainerEl;
    this.previewImgEl = previewImgEl;
    this.previewNameEl = previewNameEl;
    this.previewSizeEl = previewSizeEl;
    this.removeBtnEl = removeBtnEl;
    this.replaceBtnEl = replaceBtnEl;
    this.exampleBtnEl = exampleBtnEl;
    this.errorEl = errorEl;
    this.onFileSelected = onFileSelected;
    this.onFileRemoved = onFileRemoved;

    this.currentBlob = null;
    this.thumbnailUrl = null;
    this.currentFileName = "";

    this.init();
  }

  init() {
    // Dropzone keyboard access
    this.dropzoneEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.fileInputEl.click();
      }
    });

    // File input changes
    this.fileInputEl.addEventListener("change", (e) => this.handleFiles(e.target.files));
    if (this.cameraInputEl) {
      this.cameraInputEl.addEventListener("change", (e) => this.handleFiles(e.target.files));
    }

    // Drag and Drop
    ["dragenter", "dragover"].forEach(evtName => {
      this.dropzoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzoneEl.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(evtName => {
      this.dropzoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzoneEl.classList.remove("drag-over");
      });
    });

    this.dropzoneEl.addEventListener("drop", (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFiles(files);
      }
    });

    // Replace and Remove buttons
    if (this.replaceBtnEl) {
      this.replaceBtnEl.addEventListener("click", () => this.fileInputEl.click());
    }
    if (this.removeBtnEl) {
      this.removeBtnEl.addEventListener("click", () => this.reset());
    }

    // Try an example
    if (this.exampleBtnEl) {
      this.exampleBtnEl.addEventListener("click", () => this.loadExampleImage());
    }
  }

  async handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    this.clearError();

    // Check file size (10 MB max)
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      this.setError(`File exceeds the ${MAX_UPLOAD_MB} MB limit. Please choose a smaller photo.`);
      return;
    }

    // Check MIME and extension for HEIC/unsupported
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || 
                  /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      this.setError("This format is not supported. Please upload a JPG or PNG.");
      return;
    }

    try {
      // Decode image
      const decodedImg = await this.loadImageElement(file);
      
      // Resize to max 1024px long side, export as JPEG quality 0.9
      const processedBlob = await this.resizeToJpegBlob(decodedImg, RESIZE_MAX_PX, 0.9);
      
      // Generate 64px square thumbnail for history table
      const thumbDataUrl = await this.createThumbnailDataUrl(decodedImg, 64);

      this.currentBlob = processedBlob;
      this.thumbnailUrl = thumbDataUrl;
      this.currentFileName = file.name;

      this.showPreview(thumbDataUrl, file.name, file.size);

      if (this.onFileSelected) {
        this.onFileSelected({
          blob: processedBlob,
          thumbnailUrl: thumbDataUrl,
          fileName: file.name
        });
      }
    } catch (err) {
      console.error("[Upload] Failed decoding image:", err);
      this.setError("This format is not supported. Please upload a JPG or PNG.");
      this.reset();
    }
  }

  async loadExampleImage() {
    this.clearError();
    const examplePath = "assets/sample/example-1.jpg";
    try {
      const res = await fetch(examplePath);
      if (!res.ok) throw new Error("Sample file not found");
      const blob = await res.blob();
      const file = new File([blob], "example-aluminium-can.jpg", { type: "image/jpeg" });
      await this.handleFiles([file]);
    } catch (e) {
      console.warn("[Upload] Could not load example file:", e);
      this.setError("Sample photo 'example-1.jpg' not found in assets/sample/. Please upload an image directly.");
    }
  }

  loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        // Verify genuine dimensions
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error("Zero dimension image"));
        } else {
          resolve(img);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Image decode failed"));
      };
      img.src = objectUrl;
    });
  }

  resizeToJpegBlob(img, maxDim = RESIZE_MAX_PX, quality = 0.9) {
    return new Promise((resolve, reject) => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      
      // High quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas blob conversion failed"));
        }
      }, "image/jpeg", quality);
    });
  }

  createThumbnailDataUrl(img, size = 64) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Draw centered square crop
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - minDim) / 2;
      const sy = (img.naturalHeight - minDim) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      resolve(canvas.toDataURL("image/jpeg", 0.8));
    });
  }

  showPreview(thumbSrc, name, sizeBytes) {
    this.dropzoneEl.style.display = "none";
    this.previewContainerEl.style.display = "flex";
    this.previewImgEl.src = thumbSrc;
    this.previewNameEl.textContent = name;
    this.previewSizeEl.textContent = `${(sizeBytes / 1024).toFixed(0)} KB`;
  }

  reset() {
    this.currentBlob = null;
    this.thumbnailUrl = null;
    this.currentFileName = "";
    this.fileInputEl.value = "";
    if (this.cameraInputEl) this.cameraInputEl.value = "";
    
    this.previewContainerEl.style.display = "none";
    this.dropzoneEl.style.display = "flex";
    this.clearError();

    if (this.onFileRemoved) {
      this.onFileRemoved();
    }
  }

  setError(msg) {
    this.errorEl.textContent = msg;
  }

  clearError() {
    this.errorEl.textContent = "";
  }

  hasFile() {
    return !!this.currentBlob;
  }

  getData() {
    return {
      blob: this.currentBlob,
      thumbnailUrl: this.thumbnailUrl,
      fileName: this.currentFileName
    };
  }
}
