# Shot reference

## footage - real video (default for every narrated line)
```
{"type":"footage","clips":["px5762177", {"id":"ai_brain","start":2,"caption":"Windover skull","sub":"Dramatization"}],
 "overlay":{"kind":"number","value":"91","label":"skulls with brain tissue","suffix":"","kicker":"Windover Pond"}}
```
- `clips`: ids from `assets/clips.json`; the shot's time is split evenly between them (crossfaded). `start` = seconds into the clip.
  Short clips are slowed up to 3x automatically. Per-clip `caption`/`sub` show as a lower third.
- `overlay` (optional): `number` (counting gold figure: value, label, suffix, kicker), `statement` (text, emphasis[]),
  `hud` (scan readout over X-ray footage: label, detail, scan).
- Shot-level `caption` / `sub` also work.


Every beat in `shots.json` has a `say` (the narration it covers) and a `shot` (what is on screen while it is said).
All shots are real-time 3D scenes (Three.js): lit, shadowed, with camera moves. Text shown on screen is short;
the narration carries the story.

Common optional fields on any shot:
- `transition`: `"cut"` (default) | `"fade"` (0.5s crossfade) | `"dip"` (through black)
- `caption` / `sub`: lower-third label (board, checklist, document, timeline, photo, landscape use it)
- `cue`: a word in this beat's narration; the shot's key moment fires when the narrator says it

Word cues (`cue`, `markCue`, items' `cue`) match the *spoken* word, so pick a distinctive word from the beat's `say`.

---

## title - opening title in gold 3D lettering
`{"type":"title","title":"The Iceman's Last Day","subtitle":"A 5,300-year-old cold case","kicker":"A forensic documentary"}`
Use once, right after the cold open. 2-5 words for `title`.

## chapter - generated automatically
Chapter cards are created from each chapter's `num`/`title`/`subtitle`; do not add them as beats.

## statement - the narrator's key line, word by word in 3D
`{"type":"statement","text":"He did not freeze. He was murdered.","emphasis":["murdered"],"emphasisColor":"red"}`
Words rise as they are spoken. Max ~14 words. Use for twists and chapter-ending lines. `emphasisColor`: red | gold.

## number - a counting 3D figure
`{"type":"number","value":"5300","prefix":"","suffix":"","label":"years old","kicker":"Radiocarbon date","timeline":{"from":"3300 BC","to":"1991"}}`
`value` may contain decimals ("37.5"). `timeline` adds a rail with a travelling marker. `countFrom` sets the start value.

## board - 3D corkboard with pinned cards and red string
```
{"type":"board","title":"Case 1991-0919","cards":[
  {"kind":"polaroid","scene":"mountains","caption":"Hauslabjoch, 1991"},
  {"kind":"index","lines":["CASE FILE  No. 1991-0919","LOCATION:  ÖTZTAL ALPS","FOUND BY:  TWO HIKERS"]},
  {"kind":"note","text":"Not a modern death?"},
  {"kind":"clip","source":"Tiroler Tageszeitung","headline":"Frozen body found on glacier"},
  {"kind":"photo","image":"assets/site.jpg","cue":"museum"}],
 "links":[[0,1],[1,2]]}
```
1-5 cards. Kinds: `polaroid` (image or generated `scene`), `photo`, `index` (typed lines, types itself out), `note` (handwritten),
`clip` (newspaper). `scene` values: mountains, desert, sea, forest, city, portrait, tomb, lab, night, ruins.
Cards land in order (or at their `cue` word); strings connect `links` (default: each card to the next).
Reuse the same board later with more cards to build the case up.

## checklist - parchment on a desk, ink marks, 3D rubber stamp
```
{"type":"checklist","title":"Cause of death","subtitle":"Working theory, 1991-2001",
 "items":[{"text":"Exposure / hypothermia","mark":"check","markCue":"cold"},
          {"text":"Exhaustion in a storm","mark":"cross"},
          {"text":"Violent death","mark":"question"}],
 "stamp":{"text":"Presumed","cue":"believed"}}
```
`mark`: check | cross | question | none. Up to 5 items. `stamp` is optional (a real stamp slams down).

## document - a page on a desk, highlighter sweeps
`{"type":"document","heading":"Autopsy report","lines":["paragraph one","paragraph two"],"highlight":["severed the subclavian artery"],"style":"typed","signature":"Dr. E. Egarter-Vigl"}`
`style`: typed | letter (handwritten-looking). Highlights fire when their first word is spoken. Keep to ~80 words.

## quote - words carved into a stone slab under raking light
`{"type":"quote","text":"He bled to death within minutes.","attribution":"Forensic report, 2007"}`
Only quote real, attributable statements - otherwise use `statement`.

## map - 3D relief terrain, pin drop, location label
`{"type":"map","place":"Tisenjoch","coords":"46.7790° N, 10.8398° E","region":"Austria-Italy border","terrain":"mountain","cue":"Alps"}`
`terrain`: mountain | desert | coast | plains | forest | canyon. The relief is stylised (not real geography); the label carries the facts.

## timeline - 3D track with event plinths, camera travels along it
`{"type":"timeline","events":[{"date":"3300 BC","label":"Ötzi dies"},{"date":"1991","label":"Body found"},{"date":"2001","label":"Arrowhead found","cue":"2001"}],"highlight":2}`
2-8 events. `highlight` (index) glows red.

## photo - a print on a desk, or a full-frame slow move
`{"type":"photo","src":"assets/museum.jpg","caption":"Bolzano, Italy","credit":"Photo: Wikimedia Commons, CC BY-SA","bw":true,"layout":"desk"}`
`layout`: desk (default, 3D print on a desk) | flat (full-frame with `move`: in | out | left | right).
Without `src` (or if the file is missing) a generated `scene` is used. Only use images the user supplied or that are public domain / CC-licensed, and credit them.

## bars - 3D bar chart
`{"type":"bars","title":"Items found with the body","items":[{"label":"Arrows","value":14},{"label":"Copper axe","value":1}],"unit":"","highlight":1}`
2-7 items. `display` on an item overrides the printed value.

## xray - glowing 3D radiograph of a full skeleton
`{"type":"xray","focus":"left_shoulder","cue":"shoulder","label":"Foreign object detected","detail":"Left shoulder · dense · ~2 cm","subject":"Subject: Iceman · c. 3300 BC","scan":"CT reconstruction"}`
`focus`: full, skull, jaw, teeth, chest, spine, abdomen, pelvis, hips, left_shoulder, right_shoulder, left_arm, right_arm, left_leg, right_leg, left_knee, right_knee.
The camera pushes in on the focus and a red marker + HUD label appear at `cue`. `"marker": false` for a plain scan; `"markerShape":"sphere"` for a lesion/mass.

## artifact - museum object turning on a lit plinth
`{"type":"artifact","object":"arrowhead","material":"flint","label":"Flint arrowhead","detail":"Lodged beneath the left shoulder blade"}`
`object`: arrowhead, vase, amphora, jar, flask, coin, dagger, box, skull, tooth, tablet, ring, bone, stone.
`material` (optional override): gold, bronze, iron, silver, cream, stone, flint, clay, wood, bone, glass, red, dark.
`coin` also takes `inscription`. For a real object, put a `.glb` file in `assets/` and use `"model":"assets/axe.glb"`.

## landscape - low-poly 3D terrain flyover (establishing shots)
`{"type":"landscape","terrain":"mountain","time":"dusk","caption":"Ötztal Alps","sub":"3,210 m","particles":"snow"}`
`terrain`: mountain | desert | coast | ice | plains | forest | canyon. `time`: dawn | day | dusk | night | storm.
Optional `speed` (default 6), `altitude` (default 9).

## molecule - ball-and-stick compound
`{"type":"molecule","rings":5,"extra":["O","N"],"name":"Benzo[a]pyrene","formula":"C20H12"}`
Aromatic ring compounds (1-6 fused rings); `extra` swaps some hydrogens for other atoms. Stylised, not a chemistry diagram.
