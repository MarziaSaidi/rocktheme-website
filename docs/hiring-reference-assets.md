# Reference prototype assets

## UI reference assets

- Layout/source reference: https://www.sarahmou.com/ and /work/solace.
- Cutting mat: https://www.sarahmou.com/assets/cutting-mat.png,
  stored in `public/preview/hiring/cutting-mat.png`.
- Switzer: reference Fontshare declarations; local WOFF2 normal400, italic400,
  normal500 in `public/preview/hiring/fonts/`.
- Instrument Serif: reference public WOFF2 Latin normal/italic files, same folder.

## Previous robot render (retained, no longer on the board)

`public/preview/hiring/robot.png` is a 900×1200 static Three.js render of the
existing `public/assets/hero/robot.glb`, using its original geometry/materials,
RoomEnvironment and soft studio lighting against #dbe5eb. It adds no runtime
renderer. Source GLB SHA256:
`600d28e6df06557c87b090456c99e7601e38add48a81e45e9e5978b03e3ae693`.
The GLB is unchanged. Render script/provenance: `/tmp/hiring-robot-render/`.

## Generated stickers

Built-in imagegen was used, with transparent output. Final assets are
`public/preview/hiring/car.webp` and `public/preview/hiring/letterbox.webp`.
Original alpha is preserved in 512px WebP delivery copies. Original generated
PNGs remain in the session's `.codex/generated_images` folder.

Car prompt:

> A single cute small rounded toy car sticker for a designer portfolio collage. Three-quarter front view, soft cherry-red body, cream roof, large pale-blue windshield, small charcoal rubber wheels, friendly rounded proportions, tasteful miniature physical object, subtle realistic studio highlights, clean silhouette, no face, no eyes, no letters, no text, no logo. Isolated on genuinely transparent background, no floor, no background, no border, centered object with modest transparent margins. High-quality softly lit 3D clay product illustration, readable at 100 pixels. This is one icon only.

Letterbox prompt:

> A single cute freestanding letterbox/mailbox sticker for a designer portfolio collage. Three-quarter view, small rounded sage-green postal letterbox with a cream envelope visibly peeking through its mail slot, tiny brass detail, friendly toy-like proportions, clear recognizable mailbox silhouette. No words, no letters, no numbers, no logo, no face. Isolated on genuinely transparent background, no floor, no background, no white border, centered object with modest transparent margins. High-quality softly lit 3D clay product illustration, subtle material texture and studio highlights, readable at 100 pixels. This is one icon only.

## Current toy robot

The board now uses `public/preview/hiring/cute-robot.webp`, generated with the
built-in imagegen tool using `public/preview/hiring/car.webp` as a style reference.
This is a separate illustration. The original robot GLB and prior static render
are unchanged.

Prompt:

> Create one new cute toy robot portrait for a designer portfolio collage. The attached car is a STYLE REFERENCE ONLY: match its rounded miniature proportions, creamy glossy painted surfaces, soft studio lighting, pale blue glass and charming high-quality 3D toy aesthetic. Do not include a car. New robot design: large softly rounded ivory head, pale blue glass face with two simple dark friendly eyes, compact cream body, small cherry-red joint accents, chunky rounded feet and hands, and a little green two-leaf sprout on its head. Seated in a relaxed friendly pose, three-quarter front view. It should feel like it belongs to the same toy collection as the reference car. Simple beautiful forms, subtle highlights, no chrome, no distressed metal, no tiny mechanical clutter. Full robot including sprout and feet visible with generous breathing room, centered, fills about 75% of frame height. Portrait 3:4 composition on a plain pale blue-gray #dbe5eb studio background with a very soft grounding shadow. No border, no text, no lettering, no logo, no other objects. This is a new illustration, not a modification of an existing robot model.

## Pastel robot recolor

Current board asset: `public/preview/hiring/cute-robot-pastel.webp` (900×1200).
Edited with built-in imagegen from the previous robot illustration, then encoded as WebP. Previous version retained.

Prompt: Recolor this exact toy robot portrait to feel softer and cuter. Change cherry-red ears, joints, hands and soles to soft blush pink; ivory shell to pale warm peach cream; blue glass face to pale lavender with dark friendly eyes; sprout to sage green; background to pale warm pink cream. Preserve geometry, pose, framing, facial features, studio lighting, glossy materials and shadows. Only palette changes; no added objects, text or border.

## Friendly modern robot replacement

Current board asset: `public/preview/hiring/friendly-modern-robot.webp`. Generated using built-in imagegen; previous illustrations retained. Prompt: friendly modern desktop companion, compact warm-white pebble body, rounded head with dark face panel, round teal eyes and happy smile, short flipper arms, tiny base feet, pale mint accents, matte ceramic, warm-gray studio background. No humanoid anatomy, fingers, exposed joints, armor, sprout, antenna, text or logos. Portrait composition, soft studio lighting. Source: exec-95c14d1a-4c70-4e62-abf7-a309bd5ee2f9.png in session generated images.

## Original software designer cartoon

Current portrait: `public/preview/hiring/software-designer.webp`, generated from scratch using built-in imagegen. The user's stock reference file was unavailable and was not used. Prompt: cute professional software designer cartoon, woman with dark shoulder-length hair and round glasses, cream sweater at navy laptop, friendly expression, modern editorial illustration, rounded shapes, navy/sage/cream/coral palette, portrait 3:4 on warm off-white, no text, logos, watermark or robot. Generated source exec-f4239efb-b4e3-4d35-aa09-db8fac949097.png retained in session generated images. Earlier robots retained but no longer displayed.

Current portrait updated to `public/preview/hiring/software-designer-denim.webp`. Two built-in imagegen edits: remove eyeglasses only, then recolor olive trousers to medium-blue denim with subtle texture and seams, preserving the illustration, pose, green chair and surrounding objects. Final generated source exec-80061c3f-4496-43ae-bd80-f2c44cfe443d.png. Earlier variants retained.

Current portrait is now `public/preview/hiring/software-designer-cutout.webp`, with genuine alpha preserved. Built-in imagegen background-extraction edit: remove cream background including gaps between desk/chair legs and around leaves, retain designer without glasses, denim jeans, desk scene and rug; no added border. Generated source exec-083d36f6-464a-48a1-8085-a99905e7f96e.png. Removed the portrait wrapper's white border and background so the cutting mat shows through.

## Persian name mark

Replaced preview M marks with «مرضیه» (Persian, RTL), using locally hosted Noto Nastaliq Urdu, SIL Open Font License. Source: Google Fonts repository `ofl/notonastaliqurdu`; license stored alongside fonts. `marzia-nastaliq.woff` is a 26 KB name-only subset with shaping retained. Main cinematic site unchanged.

## Hover fairy

`public/preview/hiring/fairy.webp` is a transparent original illustration generated with built-in imagegen. Prompt: friendly adult fairy with dark hair, warm skin, cream blouse, sage dress, pale mint butterfly wings and golden wand facing down-left; polished soft cartoon shading matching the designer illustration and toy objects; isolated alpha, no text. Source exec-41f9d068-06d0-4aeb-80d1-c919b9cb612e.png. Preview-only FairyVisit now stays during hover with 48 continuously falling glowing stars, flies back right on mouse leave, and removes its portal after exit. Browser check confirmed stay beyond 3 seconds, departure and cleanup; screenshot `verification/reference-ui/fairy-shower.png`. Build passed.

Text animation now uses `fairy-pushing.webp`: built-in imagegen original, upright side profile facing right, both open hands pushing forward, cream blouse/sage dress/mint wings, transparent background, no wand. Source exec-90f776f5-2595-4c9f-84db-ef4b7fa855fd.png. Mobile shower fairy now departs on scroll, resize or outside tap and has an eight-second expiry to prevent indefinite persistence. Build passed; touch emulation verified scroll dismissal.
