import fs from "fs";
import path from "path";
import sharp from "sharp";

const input_path = path.join(import.meta.dirname, "./assets/relative");
const output_path = path.join(import.meta.dirname, "./assets/sites");

const files = fs.readdirSync(input_path);

fs.mkdirSync(output_path, { recursive: true });
files.forEach(function (inputFile) {
  const p = path.join(import.meta.dirname, "./assets/relative", inputFile);
  console.log(p);
  // return;
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
