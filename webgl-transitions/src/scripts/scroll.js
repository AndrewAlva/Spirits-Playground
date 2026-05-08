const container = document.querySelector('main.scroll-container');
const sections  = [...container.querySelectorAll('section')];

// Mutable state object — other modules import this reference and read it
// each frame; no events or callbacks needed on the consumer side.
export const scroll = {
  // Raw pixel positions
  x: 0,
  y: 0,
  // Normalized 0–1 across the full scrollable range
  normalizedX: 0,
  normalizedY: 0,
  // Which inter-section transition is active (0 = section 0→1, 1 = section 1→2, …)
  sectionIndex: 0,
  // 0 = fully on the "from" section, 1 = fully on the "to" section
  sectionProgress: 0,
};

function update() {
  scroll.x = container.scrollLeft;
  scroll.y = container.scrollTop;

  const maxX = container.scrollWidth  - container.clientWidth;
  const maxY = container.scrollHeight - container.clientHeight;

  scroll.normalizedX = maxX > 0 ? scroll.x / maxX : 0;
  scroll.normalizedY = maxY > 0 ? scroll.y / maxY : 0;

  // Each section fills the container height exactly (100vh).
  // rawFloat maps scrollY → [0, sections.length - 1]:
  //   0   = resting on section 0
  //   1   = resting on section 1
  //   N-1 = resting on last section
  const sectionH = container.clientHeight;
  const rawFloat = Math.min(scroll.y / sectionH, sections.length - 1);

  // sectionIndex is the index of the "from" scene; capped so there is always
  // a valid "to" scene one index ahead.
  scroll.sectionIndex    = Math.min(Math.floor(rawFloat), sections.length - 2);
  scroll.sectionProgress = rawFloat - scroll.sectionIndex;
}

container.addEventListener('scroll', update, { passive: true });
update(); // seed values before first frame
