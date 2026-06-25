import type { Plugin } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

interface ImageProcessorOptions {
  targetDir: string;
}

// Only target known image extensions
const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".gif",
  ".bmp",
]);

export function vitePluginImageProcessor(
  options: ImageProcessorOptions,
): Plugin {
  const { targetDir } = options;

  // Helper to calculate file hash
  function getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(fileBuffer).digest("hex");
  }

  // Helper to load/save the hash map manifest
  function getManifestPath(absoluteTargetDir: string) {
    return path.join(absoluteTargetDir, ".image-manifest.json");
  }

  function loadManifest(manifestPath: string): Record<string, string> {
    if (fs.existsSync(manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      } catch {
        return {};
      }
    }
    return {};
  }

  function saveManifest(
    manifestPath: string,
    manifest: Record<string, string>,
  ) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  async function processImagesInDir(absoluteTargetDir: string) {
    const manifestPath = getManifestPath(absoluteTargetDir);
    const manifest = loadManifest(manifestPath);
    let manifestChanged = false;

    if (!fs.existsSync(absoluteTargetDir)) {
      fs.mkdirSync(absoluteTargetDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(absoluteTargetDir);

    for (const file of files) {
      const filePath = path.join(absoluteTargetDir, file);
      const ext = path.extname(file).toLowerCase();

      // 1. Only process targeted extensions & skip directories
      if (
        !SUPPORTED_EXTENSIONS.has(ext) ||
        fs.statSync(filePath).isDirectory()
      ) {
        continue;
      }

      const baseName = path.basename(file, ext);
      const outputPath = path.join(absoluteTargetDir, `${baseName}.webp`);

      const currentHash = getFileHash(filePath);
      const savedHash = manifest[file];

      // 2. Check if hash matches AND the webp output actually exists
      if (savedHash === currentHash && fs.existsSync(outputPath)) {
        continue;
      }

      try {
        console.log(
          `[Dev Asset Optimizer] Converting: ${file} -> ${baseName}.webp`,
        );
        await sharp(filePath)
          .resize({ height: 480 })
          .webp({ quality: 100, preset: "photo" })
          .toFile(outputPath);

        // Update manifest memory
        manifest[file] = currentHash;
        manifestChanged = true;
      } catch (err) {
        console.error(`[Dev Asset Optimizer] Failed to process ${file}:`, err);
      }
    }

    // 3. Write back to .image-manifest.json if updates happened
    if (manifestChanged) {
      saveManifest(manifestPath, manifest);
    }
  }

  return {
    name: "vite-plugin-image-processor",
    apply: "serve",

    configureServer(server) {
      const absoluteTargetDir = path.resolve(server.config.root, targetDir);

      // Run initial check on server startup
      processImagesInDir(absoluteTargetDir);

      // Watch for changes while dev server is running
      server.watcher.add(absoluteTargetDir);

      const handleFileChange = (filePath: string) => {
        if (filePath.startsWith(absoluteTargetDir)) {
          const ext = path.extname(filePath).toLowerCase();
          // Avoid infinite loops by ignoring the manifest itself and generated webps
          if (ext !== ".json" && ext !== ".webp") {
            processImagesInDir(absoluteTargetDir);
          }
        }
      };

      server.watcher.on("add", handleFileChange);
      server.watcher.on("change", handleFileChange);
    },
  };
}
