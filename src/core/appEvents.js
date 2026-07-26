// Deliberately tiny, and deliberately imports nothing: the whole point is
// to give core/ui.js a way to say "a tab was activated, something needs
// re-rendering" without importing the feature modules that actually know
// what to do about it. main.js (the composition root) registers the real
// handlers once at startup; ui.js just calls the two functions below.
//
// This is what removes core/ui.js's imports of scheduleRender (render.js)
// and renderTxns (transactions/index.js) — those were the upward edges
// (core depending on features) that pulled most of core/ and half of
// features/ into one large mutually-reachable cycle (see the architecture
// audit notes from this session for the full dependency graph).

let _renderTrigger = () => {};
let _tabActivateHandler = () => {};

export function setRenderTrigger(fn) { _renderTrigger = fn; }
export function triggerRender() { _renderTrigger(); }

export function setTabActivateHandler(fn) { _tabActivateHandler = fn; }
export function onTabActivate(tabId) { _tabActivateHandler(tabId); }
