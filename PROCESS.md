# Process overview

## What I built

I chose to build a website named "The Birth Lottery" as I wanted to explore the
chances of being born in different locations in the world in addition to the
statistics on how your birth place may affect your life quality. It is a single
page website that allows you to spin the globe to "land" in a country. The website
shows the percentage chance of being born in that country by multiplying the country's
population by its crude birth rate, from World Bank figures, then dividing into its
capital. An image of the capital city of that country appears on screen with 11 click-able
dots which show real statistics about life in the country. 

The page openly shows all of its calculations and data sources so the user is always
aware of what information is being presented to them and the validity. Every stat 
names its World Bank indicator andyear, and `spec/birth-lottery.test.ts` fails 
the build if that stops being true.

## The moments that mattered

### 1. Making the live capital-city photo survive its own failure modes

[`e878e9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/e878e9c)

#### What Happened?

- Claude initially created the website with the same basic image of a city skyline
  shown for every city, which made the website a more boring experience for the user.
  The hero was planned to make each draw present the place to the user with
  interesting statistics on life quality.

#### What I Did

- The obvious fix to this issue was to obtain 200+ images and store it in the project
  files, or holding an API key that a static GitHub Page site is unable to hide.

  Instead, I chose to use Wikipedia's 'action=query' with 'origin=*', ([main.ts:239-243](main.ts#L239-L243)),
  this is keyless and CORS-open, so the fetch runs straight from the browser.
  The capital name was first attempted and then `"Capital, Country"` for the ambiguous ones
  ([main.ts:281](main.ts#L281)).

  The photo layer is simply an extra addition to the initial site, the previous basic
  silhouette of a city skyline remains underneath the photo to handle cases in which
  no photo was obtained. `applyPhoto` returns early on a null ([main.ts:313](main.ts#L313)), 
  so offline, blocked, and no-match all degrade to the old art instead of a broken hero.

#### How I Checked It Was Right

- A `photoCache` keyed by ISO code stops re-spins re-hitting the API, and `currentPhotoToken`
  ([main.ts:294](main.ts#L294), [main.ts:876-878](main.ts#L876-L878)) stops a
  slow fetch from an earlier spin covering its photo over the country the user is
  looking at. Later, in the browser, I found that the credit line went up
  when the fetch resolved rather than when the image did, thereby crediting a
  photographer while their photo wasn't yet on screen. It now goes up on
  `preload.onload` ([main.ts:316-318](main.ts#L316-L318)).

### 2. Dropping the header bar without weakening the accessibility invariants

[`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b)

#### What Happened?

- The artwork went full bleed and the white header bar was a strip of chrome
  sitting across the top of it. On the new landing screen it broke the
  full screen effect.

#### What I Did

- What initially appeared as the best way to fix it was deleting `<header>`/`<nav>`
  as it fails the "has a navigation landmark" invariant or relax the invariant
  until the design fits. I instead chose to keep the landmark and have it only painted
  when it takes keyboard focus, ([index.html:10-15](index.html#L10-L15)). That 
  satisfies both the test and the reason the test exists, since a keyboard 
  user gains a way past the canvas that the visual design never had.

#### How I Checked It Was Right

- Promoting the landing screen to the page's `<h1>` ([index.html:26](index.html#L26)) 
  meant the in-game title had to become an `<h2>` ([index.html:76](index.html#L76)) or 
  the page would ship two `<h1>`s and fail "exactly one top-level heading".

### 3. Measuring dot-label overlap instead of eyeballing it

[`e878e9c...a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/compare/e878e9c...a5a740b)

#### What Happened?

- Each stat dot had an permanently visible text label which resulted in the circles
  colliding the moment each carries a word, and at 390×844 the hero copy runs the full width of the frame.

#### What I Did

It took two changes to fix the problem. 

- The first change:
  ([`e878e9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/e878e9c))
  spread the dots into a rough grid across the middle band. This improved the issue but the 
  labels still landed on the title and odds in the bottom-left. 

- The second change:
  ([`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b))
  moved to five explicit rows with the lower rows pushed right of centre
  ([main.ts:173-191](main.ts#L173-L191)).

#### How I Checked It Was Right

- What actually fixed it was constraining the container rather than moving around
  eleven dots per breakpoint: `.stat-dots` gets a per-viewport inset, `7% 3% 8%`
  on desktop, `7% 8% 53%` and `10% 5% 46%` as the frame narrows
  ([styles.css:487-490](styles.css#L487-L490),
  [styles.css:1184-1186](styles.css#L1184-L1186),
  [styles.css:1311-1313](styles.css#L1311-L1313)). So the whole field is bounded
  away from the copy and the same 11 positions serve every country and every
  screen. 
  
  This was verified by driving Playwright across five viewports from 320px to
  2560px including live resizign, watching for collisions and overflow, rather
  than by judging one screenshot at one size.

### 4. A canvas that measures zero while its screen is hidden

[`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b)

#### What Happened?

- Adding the landing screen meant two globe canvases, one per screen, with one
  always `hidden`. `getBoundingClientRect()` on a hidden host returns 0×0, so the
  hero's globe was sized before it had a box and rendered as a smeared 1 pixel
  stretch when you pressed start.

#### What I Did

- Clamping with `Math.max(1, …)` would have made the numbers legal and the bug
  permanent. `sizeView()` now returns early on a zero rect and leaves the canvas untouched
  ([main.ts:655-668](main.ts#L655-L668)), which is only safe because something
  else guarantees a second call: a `ResizeObserver` on both hosts
  ([main.ts:1041-1045](main.ts#L1041-L1045)). 
  A `window` resize event never actions when a screen is revealed, the window didn't change size
  and the same observer picks up the mobile URL bar collapsing and orientation changes for
  free.

#### How I Checked It Was Right

- The DOM tests run in JSDOM, where there is no canvas and no layout at all; typecheck, 
  build, and lint were all green while the globe was visibly broken. 
  It started by pressing start in a real browser, which is the same way the `.hero-overlay` bug in
  [`a9db6f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a9db6f7)
  originated.

## Where to look in the history

The order of the commits is the argument. Data first
([`31c1fed`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/31c1fed)),
then the odds mechanic as pure DOM-free functions with an injectable `rng`
([`fd9c3e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/fd9c3e7)),
then tests against hand-computable fixtures
([`57bfc97`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/57bfc97)) —
all before a single pixel of the page existed
([`37ea487`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/37ea487)).
That is what made the three redesign passes that follow:
([`7b5eeed`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/7b5eeed),
[`a9db6f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a9db6f7),
[`a5a740b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-tawhidlabib/commit/a5a740b))
The flat dot-map became a rotating sphere and the stat grid became
hotspots on a photo, while the maths underneath never moved and the tests kept
proving it.
