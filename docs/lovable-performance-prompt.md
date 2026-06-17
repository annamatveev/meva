# Lovable prompt — add a "Performance / out of the request path" box

Paste into the bravo landing project. Adds a box that answers "doesn't this slow
the agents down?" Keeps the design and voice.

---

Keep the current design and voice (cream/green/gold, § eyebrows, mono labels,
grotesk headings). Add a new section/box that reassures on performance —
agents are not slowed down. Place it near "§ 07 — Connections" (e.g. as
"§ 07b — Performance" or a standalone callout box), styled like the other
bordered cards.

Eyebrow (mono, green): "§ 07b — OUT OF THE PATH"

Heading (grotesk, bold): "Zero runtime cost."

Body:
"Your agents read context from a local file — bravo is never called while they
work. No API hop, no lookup, no added latency. An agent answering a thousand
requests an hour makes a thousand local reads and zero calls to bravo."

Sub-line (muted):
"A new bundle is pulled and verified in the background (~1 ms of signature
checks on small files), never during a request. It's faster than fetching
context from a live database or API on every call."

Add two small mono stat chips (gold dot, like the connection pills):
 • "+0 ms per request"
 • "pull in the background, not inline"

Add one closing line (muted):
"The only thing that takes time is a change going live — that's the human review
you asked for, and it's tunable (seconds, webhook-triggered, or auto-approved
for low-risk edits). Fast-changing runtime memory stays in the agent and never
touches bravo."

Optionally a mono diagram line:
"request → agent → local file   (bravo is off to the side, not in the loop)"

Do not invent features. Keep it accurate: agents read a published local bundle;
bravo isn't in the inference path; verification is one-time at sync.
