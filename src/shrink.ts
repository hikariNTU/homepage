import fs from "fs";
import path from "path";
import sharp from "sharp";

const output_path = path.join(import.meta.dirname, "./assets/sites");

const files = fs.readdirSync(output_path);

fs.mkdirSync(output_path, { recursive: true });

files.forEach(function (inputFile) {
  if (inputFile.endsWith(".webp")) {
    return;
  }
  const p = path.join(output_path, inputFile);
  console.log(`[Process] ${p}`);

  sharp(p)
    .resize({
      height: 480,
    })
    .webp({ quality: 100, preset: "photo" })
    .toFile(
      path.join(
        output_path,
        path.basename(inputFile, path.extname(inputFile)) + ".webp",
      ),
    );
});
