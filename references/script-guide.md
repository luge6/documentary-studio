# Writing the documentary script

Target: an 8-12 minute YouTube documentary narrated by the user. At ~150 words/minute plus chapter cards that is
**1,200-1,700 spoken words**. Aim for ~1,450 (about 10 minutes) unless the user asks otherwise.

## Research first
- Use web search to collect facts, dates, names, numbers and the strongest twist. Prefer primary sources,
  museum/university pages and peer-reviewed summaries over listicles.
- Keep a short source list in `sources.md` in the project (title + URL per claim cluster). Put it in the video description.
- Never invent quotes, statistics or names. If a fact is disputed, say so in the narration ("researchers believe...").
- Real people and tragedies: be factual and respectful, no gore for its own sake.

## Structure (forensic / investigative documentary)
1. **Cold open (20-40s, no chapter card).** Start in the middle of the mystery. The first sentence is the most
   surprising true fact. End the cold open on a promise or a question the video will answer.
2. **Title card** beat (a `title` shot) right after the cold open.
3. **4-6 chapters** of 1.5-2.5 minutes each, each with a short evocative `title` (2-5 words) and optional `subtitle`
   (a place, a year). Each chapter: set up -> new evidence -> what it means -> a hook into the next chapter.
4. **Final chapter: the verdict.** Pull the evidence together, deliver the answer, then one line on why it matters.
5. **Outro (10-20s):** a closing line; a light call to action is fine ("...subscribe for the next case").

Retention techniques: open loops ("but that was not what the scan showed"), specific numbers, sensory detail,
questions the viewer wants answered, a reveal every 60-90 seconds, short sentences at turning points.

## Writing for the voice
- Write to be spoken: short sentences (8-20 words), active voice, one idea per sentence.
- Write numbers the way they should be read **when it matters** ("five thousand three hundred years"), otherwise
  digits are fine; the aligner copes with both.
- Avoid words the narrator might stumble on; spell out acronyms on first use.
- Do not put stage directions in `say`. Do not read chapter titles in `say`.

## Beats and shots
- One beat = one shot = 1-3 sentences, **4-12 seconds** of narration (about 10-30 words). Change shot at least every ~10s.
- Pick the shot type that *shows* the sentence: a place -> landscape/map; a date sequence -> timeline; a number ->
  number; evidence -> board/document/checklist; a body finding -> xray; an object -> artifact; a turning-point line ->
  statement; an attributed quote -> quote.
- Vary types: avoid the same type more than twice in a row. Reuse a board several times as evidence accumulates.
- Use `cue` words so the visual beat lands on the spoken word (the stamp on "cold", the X-ray marker on "shoulder").
- A good 10-minute video has ~70-100 beats.

## Before handing over the script
Run `export_script.py` - it validates every shot and prints the word count and estimated length. Fix errors,
adjust length into the 8-12 minute window, then give the user `script.md`.
