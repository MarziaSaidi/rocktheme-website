/**
 * Builds the two screen images mounted on the Selected Work monolith.
 *
 * Both faces share one screen shape, so each project's real screenshots are
 * fitted to it here rather than stretched in the shader. The output is what
 * each project's `homepageImage` points to.
 *
 *   npm run prepare:monolith-screens
 */
import sharp from "sharp";

const WIDTH = 640;
const HEIGHT = 922; // Matches the monolith screen aspect in sceneConfig (0.25 × 0.36).
const root = new URL("../public/images/projects/", import.meta.url);
const path = (file) => new URL(file, root).pathname;

/*
 * Quill & Pigeon: the recipient step. Its content column is wider than the
 * screen is tall-proportioned, so the column is fitted to the full width and
 * the page's own white continues above and below, as it does in the product.
 */
{
  const source = path("quill-and-pigeon/story/add-recipients.jpg");
  const column = await sharp(source)
    .extract({ left: 296, top: 84, width: 660, height: 450 })
    .resize({ width: WIDTH })
    .toBuffer({ resolveWithObject: true });
  const above = Math.round((HEIGHT - column.info.height) * 0.42);
  await sharp(column.data)
    .extend({
      top: above,
      bottom: HEIGHT - column.info.height - above,
      background: "#ffffff",
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path("quill-and-pigeon/monolith-screen.jpg"));
}

// Survue: the branded welcome screen beside a live detection state, on the app's black.
{
  const gutter = 24;
  const phoneWidth = Math.floor((WIDTH - gutter * 3) / 2);
  const phoneHeight = Math.round((phoneWidth * 932) / 430);
  const top = Math.round((HEIGHT - phoneHeight) / 2);
  const phone = (file) =>
    sharp(path(`survue/story/${file}`))
      .resize(phoneWidth, phoneHeight)
      .toBuffer();

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#000000" },
  })
    .composite([
      { input: await phone("welcome-dark.png"), left: gutter, top },
      { input: await phone("detection-level-one.png"), left: gutter * 2 + phoneWidth, top },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path("survue/monolith-screen.jpg"));
}

console.log("Monolith screens written.");
