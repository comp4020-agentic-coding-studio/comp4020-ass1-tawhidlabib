# Process overview

## What I built

[One paragraph: what the Birth Lottery is, and the idea behind it.]

## The moments that mattered

### 1. Making the live capital-city photo survive its own failure modes

[`e878e9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/e878e9c)

<!-- In the diff: `main.ts` — keyless CORS-open Wikipedia lookup, two-title
     fallback for ambiguous capital names, `photoCache`, the `currentPhotoToken`
     race guard, and the generative silhouette left underneath as the fallback. -->

- [What happened — the problem, or the thing that went wrong.]
- [What I did instead of the obvious thing, and why it beat the obvious one.]
- [How I knew it was right — the check I ran, what told me it landed.]

### 2. Dropping the header bar without weakening the accessibility invariants

[`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b)

<!-- In the diff: `index.html` — `<h1>` moved to the landing screen and the
     in-game title demoted to `<h2>`; `<header>`/`<nav>` kept as a focus-only
     skip link. The invariants held: exactly one `<h1>`, a `<nav>` landmark
     (`spec/invariants.test.ts`). -->

- [What happened — the problem, or the thing that went wrong.]
- [What I did instead of the obvious thing, and why it beat the obvious one.]
- [How I knew it was right — the check I ran, what told me it landed.]

### 3. Measuring dot-label overlap instead of eyeballing it

[`e878e9c...a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/compare/e878e9c...a5a740b)

<!-- In the diff: the 11 `hotspotPositions` in `main.ts` re-laid out twice —
     first a spread across the middle band, then the five-row layout that keeps
     labels off the bottom-left hero copy — plus per-viewport `.stat-dots`
     insets in `styles.css` for 1920x1080 and 390x844. -->

- [What happened — the problem, or the thing that went wrong.]
- [What I did instead of the obvious thing, and why it beat the obvious one.]
- [How I knew it was right — the check I ran, what told me it landed.]

### 4. A canvas that measures zero while its screen is hidden

[`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b)

<!-- In the diff: `main.ts` — `sizeView()` returns early on a zero-sized rect
     rather than sizing to 1x1, and a `ResizeObserver` re-sizes the canvas when
     the hidden hero is revealed, which a `window` resize event never reports. -->

- [What happened — the problem, or the thing that went wrong.]
- [What I did instead of the obvious thing, and why it beat the obvious one.]
- [How I knew it was right — the check I ran, what told me it landed.]
