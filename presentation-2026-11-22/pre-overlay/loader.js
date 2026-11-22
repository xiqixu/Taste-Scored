/** Dormant by default: no DOM, styles, fetches, canvases or animation loops.
 * P activates the optional presentation layer; ?pre=1 opts in on navigation. */
let active = null;
let loading = null;
let wanted = false;

async function activate() {
  wanted = true;
  if (active || loading) return;
  loading = import('./controller.js');
  try {
    const { mountPresentation } = await loading;
    if (!wanted) return;
    const mounted = await mountPresentation({ onExit: () => { active = null; wanted = false; } });
    if (wanted) active = mounted;
    else mounted.exit();
  } catch (error) {
    console.error('The optional presentation layer could not start.', error);
    wanted = false;
  } finally { loading = null; }
}

function editing(event) {
  return event.composedPath().some(el => el instanceof HTMLElement && (el.matches('input,textarea,select') || el.isContentEditable));
}
addEventListener('keydown', event => {
  if (event.key.toLowerCase() !== 'p' || event.ctrlKey || event.altKey || event.metaKey || event.repeat || editing(event)) return;
  event.preventDefault();
  if (active) active.exit();
  else if (loading) wanted = !wanted;
  else activate();
});
if (new URL(location.href).searchParams.get('pre') === '1') activate();
