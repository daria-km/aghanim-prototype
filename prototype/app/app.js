/* Shared prototype runtime: state across pages, header with mode + game switchers,
 * launch windows (Verify your company, Connect your game), item form, toast, hub preview. */
window.AG = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- state (kept between pages; falls back to memory) ---------- */
  const KEY = 'aghanim-proto-v1';
  const DEFAULT = {
    verify: { step: 0, status: 'none' }, // status: none | draft | review | approved
    connect: 0, endpoint: '',
    published: false, purchase: false, celebrated: false,
    imagesFixed: true, edited: {}, itemEdits: {},   // Newton draws every item's picture while he builds (Daria, 27.09: no "No image" anywhere)
    event: null,  // the event Newton builds in the chat (handoff 6.10)
    drafts: {},   // drafts made from Newton's ready starts, by section
    hub: null,    // the look of the hub: what the dice rolled and what is locked (handoff 5.4)
    flash: null,  // { key, at } — what Newton just added, so the page can light it up
    applied: {},  // changes Newton made from a task (goldChest linked, day 7 reward…)
    undone: {},   // rows of Newton's log on Home that were taken back (handoff 6.9)
    style: null,  // the style tags from onboarding: { tags, newton } — Hub's Styles and the dice follow them
    done: {}      // action cards whose task is finished — they leave the page
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let mem = clone(DEFAULT);
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return Object.assign(clone(DEFAULT), JSON.parse(s)); } catch (e) { /* storage blocked */ }
    return mem;
  }
  let state = load();
  function save(patch) {
    /* sent for review: note when (the review comes back by itself — see approveLater) */
    if (patch.verify && patch.verify.status === 'review' && !patch.verify.sentAt) patch = Object.assign({}, patch, { verify: Object.assign({}, patch.verify, { sentAt: Date.now() }) });
    state = Object.assign({}, state, patch);
    mem = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
    document.dispatchEvent(new CustomEvent('ag:change'));
  }
  /* the review comes back by itself (Daria, 28.09: no "Approve now (prototype)" button): 30 seconds after it was sent, on any
     page. Newton says so in the chat and Home lists it under Latest — it mustn't pass unnoticed. */
  const REVIEW_MS = 30000;
  function approveLater() {
    const v = state.verify;
    if (v.status !== 'review') return;
    if (!v.sentAt) { save({ verify: Object.assign({}, v, { sentAt: Date.now() }) }); return; }
    if (Date.now() - v.sentAt >= REVIEW_MS) save({ verify: Object.assign({}, v, { status: 'approved', approvedAt: Date.now() }) });
  }
  setInterval(approveLater, 2000);
  function reset() { try { localStorage.removeItem('aghanim-proto-chat'); } catch (e) { /* storage blocked */ } save(clone(DEFAULT)); }
  const VERIFY_TOTAL = 4, CONNECT_TOTAL = 5;
  /* the verification, step by step in the chat with Newton — the same four steps in onboarding and on Dashboard (Daria, 27.09) */
  const VSTEPS = [
    { title: 'Company', lead: 'Great. First, the company — I’ve filled in what your store page says.', cta: 'Continue',
      fields: () => [{ label: 'Company name', value: 'Raider Games Ltd.' }, { label: 'Website or store link', value: 'https://apps.apple.com/app/pixel-raiders/id6450012345', half: true },
        { label: 'Country of registration', value: 'Cyprus', hint: 'From your App Store page — check it', half: true }] },
    { title: 'Legal details', lead: 'Now the legal name and where you’re registered.', cta: 'Continue',
      fields: () => [{ label: 'Legal business name', value: 'Raider Games Ltd.' }, { label: 'Tax ID', ph: 'From your papers', half: true, sample: 'CY 1029384756' },
        { label: 'Registered address', half: true, sample: '12 Makariou III, Limassol' }] },
    { title: 'Signatory', lead: 'Who signs the agreement?', cta: 'Continue',
      fields: () => [{ label: 'Full name', ph: 'Who signs for the company', half: true, sample: 'Alex Kim' }, { label: 'Role', ph: 'Director, founder…', half: true, sample: 'Director' },
        { label: 'Work email', value: 'alex@raidergames.com' }] },
    { title: 'Owner', lead: 'Last one — anyone who owns 25% or more.', cta: 'Submit for review',
      fields: () => [{ label: 'Full name', half: true, sample: 'Alex Kim' }, { label: 'Ownership', ph: 'e.g. 60%', half: true, sample: '100%' }] }
  ];
  const homeState = () => (state.purchase ? 3 : state.published ? 2 : 1);
  const verified = () => state.verify.status === 'approved';
  const canPublish = () => verified() && state.connect >= 3;
  function publishBlocker() {
    const need = [];
    if (!verified()) need.push('company verification');
    if (state.connect < 3) need.push('the 3 webhooks in Connect your game');
    return need.length ? 'Publishing opens after ' + need.join(' and ') + '.' : '';
  }

  /* ---------- icons ---------- */
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="currentColor"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.5 3 3 6-6" fill="none" stroke="var(--color-fg-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-updown" viewBox="0 0 24 24"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol><symbol id="i-t-launch" viewBox="0 0 24 24"><path d="M5 22V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 3.5h13l-3 4.5 3 4.5H5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol><symbol id="i-t-fix" viewBox="0 0 24 24"><path d="M15.5 2.5a5.5 5.5 0 0 0-5.3 7.1L2.8 17a2.4 2.4 0 0 0 3.4 3.4l7.4-7.4a5.5 5.5 0 0 0 7.1-5.3l-3.3 3.3-3.4-.8-.8-3.4z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol><symbol id="i-t-sales" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2.5 3.5a1 1 0 0 1 1-1h8l10 10-9 9-10-10zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></symbol><symbol id="i-t-players" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.5" fill="currentColor"/><path d="M3.5 21.5a8.5 8.5 0 0 1 17 0z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol><symbol id="i-t-event" viewBox="0 0 24 24"><path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9l-6.1 3.5 1.5-6.8L2.2 9l6.9-.7z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-tick" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18 M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.9 M6.6 6.6C3.8 8.3 2 12 2 12s3.5 6 10 6a9.6 9.6 0 0 0 5.4-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><path d="M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-unlock" viewBox="0 0 24 24"><path d="M6 11h12v10H6z M8 11V7a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-dice" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.2 20.5 7v10L12 21.8 3.5 17V7z M3.5 7 12 11.8 20.5 7 M12 11.8v10" stroke-width="1.9"/><path d="M8.2 6.9h.01 M12 6.9h.01 M15.8 6.9h.01 M6.1 11.4h.01 M9.4 13.3h.01 M6.1 15.5h.01 M9.4 17.4h.01" stroke-width="2.3"/><path d="M16.3 14.4h.01" stroke-width="3.4"/></g></symbol>
  <symbol id="i-page" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z M15 3v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path d="M4 5h16v14H4z M8 9h8 M8 13h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-store" viewBox="0 0 24 24"><path d="M4 7h16l-1 13H5z M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-mega" viewBox="0 0 24 24"><path d="M3 11v2l13 5V6z M16 9a3 3 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16 5a3 3 0 0 1 0 6 M18 20a5 5 0 0 0-3-4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V10 M10 20V4 M16 20v-7 M21 20H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-mic" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M19 11a7 7 0 0 1-14 0 M12 18v3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path d="M12 19V6 M6 12l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-clip" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><path d="M9 9h10v12H9z M15 9V3H5v12h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-up" viewBox="0 0 24 24"><path d="M7 11h3l2-7a2.5 2.5 0 0 1 2.5 2.5V10h3.5a1.5 1.5 0 0 1 1.5 1.8l-1.3 6A2 2 0 0 1 16.2 19H7z M7 11v8H4v-8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="M17 13h-3l-2 7a2.5 2.5 0 0 1-2.5-2.5V14H5.9a1.5 1.5 0 0 1-1.5-1.8l1.3-6A2 2 0 0 1 7.8 5H17z M17 13V5h3v8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
  <symbol id="i-up-right" viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 7-7 M15 8h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-time" viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path d="M8.5 2.5h7a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z M10.5 18.5h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-tablet" viewBox="0 0 24 24"><path d="M6.5 2.5h11a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-more-room" viewBox="0 0 24 24"><path d="M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-tighter" viewBox="0 0 24 24"><path d="M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-taller" viewBox="0 0 24 24"><path d="M12 22v-6 M12 8V2 M4 12H2 M10 12H8 M16 12h-2 M22 12h-2 M15 19l-3 3-3-3 M15 5l-3-3-3 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-shorter" viewBox="0 0 24 24"><path d="M12 22v-6 M12 8V2 M4 12H2 M10 12H8 M16 12h-2 M22 12h-2 M15 19l-3-3-3 3 M15 5l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-zoom-in" viewBox="0 0 24 24"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M11 8v6 M8 11h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-zoom-out" viewBox="0 0 24 24"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M8 11h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-list-plus" viewBox="0 0 24 24"><path d="M11 12H3 M16 6H3 M16 18H3 M18 9v6 M21 12h-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-list-minus" viewBox="0 0 24 24"><path d="M11 12H3 M16 6H3 M16 18H3 M21 12h-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-image" viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-gift" viewBox="0 0 24 24"><path d="M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-news" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2 M18 14h-8 M15 18h-5 M10 6h8v4h-8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-pen" viewBox="0 0 24 24"><path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-group" viewBox="0 0 24 24"><path d="M4 3h6v6H4z M4 15h6v6H4z M14 4h7 M14 8h5 M14 16h7 M14 20h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-grid-plus" viewBox="0 0 24 24"><path d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 14v6 M14 17h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-grid-minus" viewBox="0 0 24 24"><path d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 17h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-redo" viewBox="0 0 24 24"><path d="M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-palette" viewBox="0 0 24 24"><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3c.4.5.5 1 .5 1.4 0 1-.9 1.8-3 1.8z M7.5 11.5h.01 M10.5 7.5h.01 M15.5 8.5h.01" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-desktop" viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v10H4V6a1 1 0 0 1 1-1z M2 19.5h20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9 M12 3c-2.5 2.7-3.6 5.7-3.6 9s1.1 6.3 3.6 9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4 M7 9l5-5 5 5 M5 20h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  </svg>`;
  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const nwIcon = (title = 'Made by Newton') => `<svg class="ai-ico" role="img" aria-label="${title}"><title>${title}</title><use href="#i-spark"/></svg>`;
  const nwLabel = () => `<span class="nw-label">${nwIcon()}Newton</span>`;

  /* ---------- shared data ---------- */
  // Store items Newton generated from the App Store page (a guess about the game economy, see handoff 6.6)
  const items = [
    { id: 'gem', name: 'Gem Pack', sub: '1,200 gems', price: '$9.99', sku: 'gems_1200', art: true, cat: 'Gems', badge: '+20%' },
    { id: 'shards', name: 'Hero Shards', sub: '3 hero shards', price: '$4.99', sku: 'hero_shards_3', art: false, cat: 'Heroes', badge: 'NEW' },
    { id: 'chest', name: 'Gold Chest', sub: '5 random rewards', price: '$19.99', get sku() { return state.applied.goldChest || state.applied.allLinked ? 'chest_gold' : ''; }, art: false, cat: 'Chests', badge: 'HOT' },   // linked from a task in the chat
    { id: 'energy', name: 'Energy Refill', sub: '100 energy', price: '$1.99', sku: 'energy_100', art: false, cat: 'Energy', badge: '-30%' },
    { id: 'gems500', name: 'Gem Stack', sub: '500 gems', price: '$4.99', sku: 'gems_500', art: true, cat: 'Gems' },
    { id: 'vault', name: 'Gem Vault', sub: '6,500 gems', price: '$49.99', get sku() { return state.applied.allLinked ? 'gems_6500' : ''; }, art: true, cat: 'Gems' },
    { id: 'legend', name: 'Legendary Shard', sub: '1 legendary hero shard', price: '$14.99', get sku() { return state.applied.allLinked ? 'hero_shard_legend' : ''; }, art: true, cat: 'Heroes' },
    { id: 'xp', name: 'XP Booster', sub: 'Double XP for 24 hours', price: '$2.99', get sku() { return state.applied.allLinked ? 'xp_boost_24h' : ''; }, art: true, cat: 'Energy' }
  ];
  /* a change made by hand (Items → a row → the form in the chat) is kept: state.itemEdits[id] overrides the name, contents,
     price and SKU everywhere the item shows — the table, the hub (Daria, 27.09: "Saved" left the old price on the page) */
  items.forEach((it) => ['name', 'sub', 'price', 'sku'].forEach((k) => {
    const d = Object.getOwnPropertyDescriptor(it, k), base = d.get ? d.get : () => d.value;
    Object.defineProperty(it, k, { enumerable: true, configurable: true,
      get: () => { const e = (state.itemEdits || {})[it.id]; return e && e[k] ? e[k] : base.call(it); } });
  }));
  const hasImage = (it) => it.art || state.imagesFixed || state.applied.images;
  const byNewton = (id) => !state.edited[id];

  /* ---------- style tags: picked in onboarding, changed later in Hub → Styles (one set for both) ----------
     picked — what Newton read from the store page; each style keeps its own kit colour so a pick reads at a glance */
  const STYLE_TAGS = {
    picked: ['Bold and loud', 'Retro arcade', 'Fantasy', 'Pixel art'],   // the last one leads the look in Hub (it gets the art)
    near: ['Hand-drawn', 'Cartoon', 'Anime', 'Dark', 'Neon', 'Medieval', 'Cozy', 'Minimal', 'Low poly', 'Premium gold'],
    far: ['3D render', 'Cel-shaded', 'Sci-fi', 'Cyberpunk', 'Military', 'Space', 'Horror', 'Steampunk', 'Pastel'],
    color: {
      'Pixel art': 'blue', 'Fantasy': 'violet', 'Retro arcade': 'pink', 'Bold and loud': 'orange',
      'Hand-drawn': 'lime', 'Cartoon': 'orange', 'Anime': 'violet', 'Dark': 'dark', 'Neon': 'pink',
      'Medieval': 'red', 'Cozy': 'orange', 'Minimal': 'gray', 'Low poly': 'green', 'Premium gold': 'orange',
      '3D render': 'blue', 'Cel-shaded': 'lime', 'Sci-fi': 'blue', 'Cyberpunk': 'pink', 'Military': 'green',
      'Space': 'violet', 'Horror': 'red', 'Steampunk': 'orange', 'Pastel': 'pink'
    }
  };
  const style = () => state.style || { tags: STYLE_TAGS.picked.slice(), newton: STYLE_TAGS.picked.slice() };

  /* What the prototype doesn't have yet says so with a smile (Daria, 27.09 — instead of a dry "Not in this prototype"):
     every such control gets its own phrase from the set, always the same one for the same control. */
  const SOON = ['Not today, sorry 😞', 'Coming soon', 'Still thinking about it…', 'Almost done', 'In the next patch', 'Unlocks at level 2',
    'Still in the forge 🔨', 'Respawning soon', 'Soon™', 'Newton is on it ✨', 'Loading… any day now', 'On the roadmap, promise'];
  const given = new Map();   // control → its phrase; a phrase already taken on the page goes to the next free one
  const soon = (key) => {
    key = String(key || '');
    if (given.has(key)) return given.get(key);
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const taken = new Set(given.values());
    let i = h % SOON.length; for (let n = 0; n < SOON.length && taken.has(SOON[i]); n++) i = (i + 1) % SOON.length;
    given.set(key, SOON[i]); return SOON[i];
  };
  const DRY = 'Not in this prototype';
  const smile = (root) => root.querySelectorAll(`[data-proto-tip="${DRY}"]`).forEach((el) => { el.dataset.protoTip = soon(el.getAttribute('aria-label') || el.textContent.trim()); });
  /* Every button says what it does with an icon too (Daria, 27.09) — above all the plain-text ones, which otherwise read as
     words: Change — a pencil, Cancel — a cross, Schedule — a calendar, Undo — its arrow. One dictionary for the whole
     product, by the button's verb, so a new button gets its icon without anyone remembering. A button that sets Newton
     working on (ag-btn--ai) gets his spark. Every icon stands after the words (Daria, 27.09 — one CSS rule, dark-primary.css).
     Skipped: buttons that already have an icon, icon-only buttons, data-noic. */
  const BTN_IC = [
    [/^(add|new)\b/, 'plus'], [/^link\b/, 'link'], [/^(change|edit|write)\b/, 'pen'], [/^(cancel|close|dismiss)\b/, 'x'],
    [/just watch/, 'eye'], [/^(not now|later)\b/, 'time'], [/^(delete|remove)\b/, 'trash'], [/^(schedule|extend)\b/, 'calendar'],
    [/^(publish|go live)/, 'globe'], [/^(let’s make it live|let's make it live)/, 'arrow'], [/^undo\b/, 'undo'], [/^redo\b/, 'redo'], [/^stop\b/, 'stop'],
    [/^(save|done|yes|apply|use these|approve|ok|got it)\b/, 'tick'], [/^(verify|start verification)/, 'shield'], [/^send\b/, 'send'],
    [/^(show|see|view|preview)\b/, 'eye'], [/^copy\b/, 'copy'], [/^upload\b/, 'upload'], [/^(reroll|another)\b/, 'dice'],
    [/^(build|decide|generate|fill|do )/, 'spark'], [/^(open|continue|next|set up|start|go|back to)\b/, 'arrow'], [/^prefer to do it by hand/, 'arrow']];
  const btnIcon = (label) => { const t = label.trim().toLowerCase(); const hit = BTN_IC.find(([re]) => re.test(t)); return hit ? hit[1] : null; };
  const iconize = (root) => root.querySelectorAll('.ag-btn:not([data-ic]):not(.ag-btn--icon):not([data-noic])').forEach((b) => {
    b.dataset.ic = '1';
    if (b.querySelector('svg') || !b.textContent.trim()) return;
    const id = b.classList.contains('ag-btn--ai') ? 'spark' : btnIcon(b.textContent);
    if (!id) return;
    b.insertAdjacentHTML(id === 'arrow' || id === 'spark' ? 'beforeend' : 'afterbegin', `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`);
  });
  new MutationObserver(() => { smile(document); iconize(document); }).observe(document.documentElement, { childList: true, subtree: true });
  /* our black tooltip for what isn't built: the control ignores the mouse (no hover, no click — app.css), so it is found
     by where the pointer is; above it for .tip-up, else to its right; always inside the window */
  let tipEl = null, tipFor = null, tipRaf = 0;
  function tipAt(x, y) {
    const under = document.elementFromPoint(x, y);
    const inside = (r) => r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    /* really seen at the point: not clipped away by a folded or scrolled parent, not under a window on top */
    const seen = (c) => { for (let p = c.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflow !== 'visible' && !inside(p.getBoundingClientRect())) return false; } return true; };
    const el = [...document.querySelectorAll('[data-proto-tip], [data-hint]')].reverse().find((c) => inside(c.getBoundingClientRect())
      && under && (under === c || under.contains(c) || c.contains(under)) && seen(c));
    if (!el) { if (tipEl) tipEl.classList.remove('is-on'); tipFor = null; return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ag-tooltip proto-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    if (tipFor !== el) { tipFor = el; tipEl.textContent = el.dataset.protoTip || el.dataset.hint; }   // data-hint: the same tooltip on a live control (an icon-only button)
    let r = el.getBoundingClientRect(); const t = tipEl.getBoundingClientRect(), W = window.innerWidth;
    /* a wide row (a menu item across the sidebar): the tooltip goes right after its text, not after the empty row */
    const rg = document.createRange(); rg.selectNodeContents(el); const cr = rg.getBoundingClientRect();
    if (cr.width && r.width - cr.width > 40) r = { left: r.left, right: cr.right, top: r.top, bottom: r.bottom, width: cr.right - r.left, height: r.height };
    let left, top;
    if (el.classList.contains('tip-up')) { left = r.left + r.width / 2 - t.width / 2; top = r.top - t.height - 8; }
    else { left = r.right + 8; top = r.top + r.height / 2 - t.height / 2; if (left + t.width > W - 8) left = r.left - t.width - 8; }
    left = Math.max(8, Math.min(left, W - t.width - 8)); top = Math.max(8, top);
    tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    tipEl.classList.add('is-on');
  }
  document.addEventListener('mousemove', (e) => { const now = performance.now(); if (now - tipRaf < 40) return; tipRaf = now; tipAt(e.clientX, e.clientY); }, { passive: true });   // at most every 40 ms
  document.addEventListener('scroll', () => { if (tipEl) tipEl.classList.remove('is-on'); tipFor = null; }, true);
  document.addEventListener('DOMContentLoaded', () => { smile(document); iconize(document); });

  /* the hub as it really is, inside a laptop or a phone mock-up (Daria, 27.09 — the new looks reach onboarding):
     Hub.html in preview mode, scaled to the mock-up's screen. It follows the style tags because Hub builds its look
     from them, and it redraws when the state changes (the storage event reaches the frame). */
  const hubPreview = (dev = 'desktop') => `<iframe class="hubprev" data-dev="${dev}" src="Hub.html?embed=${dev}" tabindex="-1" aria-hidden="true" title="Hub preview"></iframe>`;
  function fitPreview(f) {
    if (!f || !f.parentElement) return;
    const W = f.dataset.dev === 'phone' ? 375 : 1280, box = f.parentElement, k = box.clientWidth / W;
    if (!k) return;
    Object.assign(f.style, { width: `${W}px`, height: `${Math.ceil(box.clientHeight / k)}px`, transform: `scale(${k})` });
  }
  const prevRO = window.ResizeObserver ? new ResizeObserver((es) => es.forEach((e) => fitPreview(e.target.querySelector('iframe.hubprev')))) : null;
  /* A page that redraws often (Home) keeps its previews: the loaded hubs are carried into the new markup instead of
     loading again (Daria, 27.09 — Home shows the hub as it was left in Hub; no reloading, no flicker).
     Uses moveBefore, which keeps a frame alive while it moves; without it the preview just loads again. */
  function setKeepingPreviews(el, html) {
    const old = [...el.querySelectorAll('iframe.hubprev')];
    let hold = document.getElementById('prev-hold');
    if (!hold) { hold = document.createElement('div'); hold.id = 'prev-hold'; hold.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:400px;overflow:hidden'; document.body.appendChild(hold); }
    const can = typeof hold.moveBefore === 'function';
    if (can) old.forEach((f) => hold.moveBefore(f, null));
    el.innerHTML = html;
    if (!can) return;
    el.querySelectorAll('iframe.hubprev').forEach((f) => {
      const o = [...hold.children].find((x) => x.dataset.dev === f.dataset.dev);
      if (!o) return;
      f.parentElement.moveBefore(o, f); f.remove(); fitPreview(o); if (prevRO) prevRO.observe(o.parentElement);
    });
    hold.replaceChildren();
  }
  new MutationObserver(() => document.querySelectorAll('iframe.hubprev:not([data-fit])').forEach((f) => {
    f.dataset.fit = '1'; fitPreview(f); if (prevRO) prevRO.observe(f.parentElement);
  })).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- header: mode + game switchers ---------- */
  // Localization, Settings and Company stay in the menu but are not built for the test task (Daria, 25.09).
  // They look like any other item — it's the prototype that lacks them, not the product (Daria, 26.09): a hover tooltip says so.
  const MODES = [['hub', 'Hub', 'Hub.html'], ['dashboard', 'Dashboard', 'Dashboard.html'], ['localization', 'Localization', ''], ['settings', 'Settings', ''], ['company', 'Company', '']];
  /* The header (Daria, 27.09): one panel on the left, drawn like Hub's bottom bar — you, the mode, the game — flush with
     the left edge of the work area below it, one clean vertical. What a page adds (Hub: publish state, Preview, Publish)
     goes to the right, its buttons in the same kind of panel. */
  function header(mode, left = '', right = '') {
    const cur = MODES.find((m) => m[0] === mode);
    const modeItems = MODES.map((m, i) => m[2]
      ? `<a class="ag-menu__item${m[0] === mode ? ' is-active' : ''}" role="menuitem" href="${m[2]}">${m[1]}</a>`
      : `<button class="ag-menu__item" role="menuitem" aria-disabled="true" data-proto-tip="Not in this prototype">${m[1]}</button>`).join('');
    const company = mode === 'company';
    return `
      <div class="hdr-bar">
        <!-- the prototype's own controls live in the avatar's menu again (Daria, 28.09: not a separate pill) -->
        <div class="dd">
          <button class="hdr-av" data-dd="proto" aria-haspopup="menu" aria-expanded="false" aria-label="Alex · prototype controls">A</button>
          <div class="ag-menu dd__menu proto-menu" data-menu="proto" role="menu" hidden></div>
        </div>
        <span class="hdr-sep"></span>
        <div class="dd">
          <button class="ag-select switch" data-dd="mode" aria-haspopup="menu" aria-expanded="false" aria-label="Mode: ${cur[1]}"><span>${cur[1]}</span>${icon('chev')}</button>
          <div class="ag-menu dd__menu" data-menu="mode" role="menu" hidden>${modeItems}</div>
        </div>
        <div class="dd">
          <button class="ag-select switch" data-dd="game" aria-haspopup="menu" aria-expanded="false" aria-label="Game: ${company ? 'All games' : 'Pixel Raiders'}"${company ? ' title="Company settings apply to all games"' : ''}>${company ? '<span class="logo-mark" style="background:var(--color-fg-tertiary);color:var(--color-text-secondary)">R</span><span>All games</span>' : '<span class="game-ico"></span><span>Pixel Raiders</span>'}${icon('chev')}</button>
          <div class="ag-menu dd__menu" data-menu="game" role="menu" hidden>
            <div class="text-section-label">Raider Games Ltd.</div>
            <a class="ag-menu__item${company ? '' : ' is-active'}" role="menuitem" href="${company ? 'Dashboard.html' : '#'}" data-noop="${company ? '' : '1'}"><span class="game-ico"></span>Pixel Raiders</a>
            <div class="ag-menu__sep"></div>
            <a class="ag-menu__item" role="menuitem" href="Onboarding.html#start">${icon('plus')}Add game</a>
          </div>
        </div>
      </div>
      ${left}
      <span class="ag-spacer"></span>
      ${right}`;
  }
  /* ---------- the prototype's own controls — in the avatar's menu (Daria, 27.09) ----------
     Not part of the product: switching Home's three states (was a row under Home), the first purchase, and starting
     over — this page (its conversation, its cards, its drafts; Hub: its look), the Halloween event, or everything. */
  /* the prototype menu jumps between Home states: protoSwitch tells Newton to start over. A real step (Publish, the first
     purchase) moves the state on without it — the conversations and the event stay (Daria, 27.09: publishing wiped the
     scheduled event) */
  /* a state picked here starts that state over (Daria, 28.09: back to "Hub just built", the cards to do must come back — that's
     what the switch is for): the tasks done, drafts, Newton's changes, undone rows and the event are cleared; the hub's look,
     the style tags and onboarding stay */
  const FRESH = () => ({ done: {}, applied: {}, drafts: {}, undone: {}, itemEdits: {}, edited: {}, event: null, flash: null, celebrated: false });
  function homeTo(n) {
    if (n === 1) save(Object.assign(FRESH(), { verify: { step: 0, status: 'none' }, connect: 0, endpoint: '', published: false, purchase: false, protoSwitch: Date.now() }));
    else save(Object.assign(FRESH(), { verify: { step: VERIFY_TOTAL, status: 'approved' }, connect: Math.max(state.connect, 3), published: true, purchase: n === 3, protoSwitch: Date.now() }));
  }
  const onDashboard = () => /Dashboard\.html$/.test(location.pathname);
  /* the prototype menu (Daria, 28.09: clear, the same words on every page): see Home in another state, make something happen,
     start again. Each line says what it does. */
  /* the states a page can show (Daria, 28.09: not just Home — every page that looks different in another state gets its own
     list, and switching keeps you on the page). The prototype's state is one for all pages: 1 hub just built, 2 live, 3 selling. */
  const pageKey = () => (onDashboard() ? (location.hash.slice(1) || 'home') : /Hub\.html$/.test(location.pathname) ? 'hub' : '');
  const PAGE_STATES = {
    home: ['See Home as', [[1, 'Hub just built', 'Verification and the game are still to do'], [2, 'Live, no purchases yet', 'Players are coming in'], [3, 'Live and selling', 'A week of sales']]],
    'analytics-transactions': ['See Transactions as', [[2, 'No purchases yet', 'The hub is live, nobody has bought'], [3, 'A week of sales', 'Purchases, and three failed on Wednesday']]],
    hub: ['See the hub as', [[1, 'Not published yet', 'Only you see it'], [2, 'Live', 'Players see it and buy']]]
  };
  function protoMenu() {
    const h = homeState(), v = state.verify.status, ps = PAGE_STATES[pageKey()];
    const item = (k, label, sub, on) => `<button class="ag-menu__item proto-item${on ? ' is-active' : ''}" role="menuitem" data-proto="${k}"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}${on ? icon('tick', 'proto-item__on') : ''}</button>`;
    /* which of the page's states is on now: the closest one at or below the prototype's state */
    const cur = ps ? ps[1].filter(([n]) => n <= h).pop() || ps[1][0] : null;
    const page = window.AG && AG.newton && AG.newton.restartPage && document.getElementById('nw-chat');
    const acts = [h === 2 ? item('purchase', 'Simulate the first purchase', 'A player buys — Home moves to “Live and selling”') : '',
      v === 'review' ? item('approve', 'Approve verification', 'As if the review came back — publishing and payments open') : ''].join('');
    return `<div class="proto-menu__note">Prototype controls — not part of the product</div>
      ${ps ? `<div class="text-section-label">${ps[0]}</div>${ps[1].map(([n, l, sub]) => item(`state-${n}`, l, sub, cur[0] === n)).join('')}<div class="ag-menu__sep"></div>` : ''}
      ${acts ? `<div class="text-section-label">Make it happen</div>${acts}<div class="ag-menu__sep"></div>` : ''}
      <div class="text-section-label">Start again</div>
      ${page ? item('page', 'This page', 'Its chat and cards, as on the first visit') : ''}
      ${state.event ? item('event', 'The Halloween event', 'Take it apart and build it again') : ''}
      <button class="ag-menu__item proto-item" role="menuitem" data-proto-reset><b>Everything, from onboarding</b><small>Back to the very first screen</small></button>`;
  }
  function proto(k) {
    const home = () => { if (!onDashboard()) go('Dashboard.html#home'); else if (location.hash.slice(1) !== 'home' && location.hash) location.hash = 'home'; };
    const onHome = onDashboard() && (location.hash.slice(1) || 'home') === 'home';
    const apply = (fn) => { if (onHome) swap(fn, $('#page')); else { fn(); home(); } };
    /* a state stays on the page it was picked on */
    if (k.startsWith('state-')) { const fn = () => homeTo(Number(k.slice(6))); if (onDashboard()) swap(fn, $('#page')); else fn(); }
    if (k === 'purchase') apply(() => save({ purchase: true }));
    if (k === 'approve') save({ verify: { step: VERIFY_TOTAL, status: 'approved' } });
    if (k === 'page') { AG.newton.restartPage(); location.reload(); }
    if (k === 'event') { AG.newton.restartEvent(); location.reload(); }
  }
  function closeMenus() {
    $$('[data-menu]').forEach((m) => { m.hidden = true; });
    $$('[data-dd]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function bindHeader(root) {
    $$('[data-dd]', root).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = $(`[data-menu="${b.dataset.dd}"]`, root);
      if (b.dataset.dd === 'proto' && m.hidden) m.innerHTML = protoMenu();   // fresh each time: the state it shows is now
      const open = m.hidden; closeMenus();
      m.hidden = !open; b.setAttribute('aria-expanded', String(open));
    }));
    $$('[data-noop]', root).forEach((a) => { if (a.dataset.noop) a.addEventListener('click', (e) => { e.preventDefault(); closeMenus(); }); });
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-proto-reset]')) { closeMenus(); reset(); go('Onboarding.html#start'); return; }
      const p = e.target.closest('[data-proto]'); if (p) { closeMenus(); proto(p.dataset.proto); }
    });
  }
  function mountHeader(mode, left, right) {
    const h = $('#app-header');
    h.innerHTML = header(mode, left, right);
    bindHeader(h);
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.dd')) closeMenus(); });
  /* the item form belongs to the page it was opened on: another section closes it */
  window.addEventListener('hashchange', () => { const d = $('#m-item'); if (d && !d.hidden) close(d); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = [...$$('.ag-backdrop'), ...$$('.drawer-bg')].find((m) => !m.hidden);
      if (open) close(open); else closeMenus();
      return;
    }
    if (e.altKey && /^Digit[1-5]$/.test(e.code) && !e.target.closest('input, textarea')) {
      const to = MODES[Number(e.code.slice(5)) - 1][2]; if (to) { e.preventDefault(); go(to); }
    }
  });

  /* ---------- sidebar: one component for every mode ---------- */
  // Dashboard: sections by value for the business, Analytics right after Home (Daria, 25.09).
  // Inside Items: Item properties, Categories, Price templates. Storefronts live in Hub (Store page settings).
  // Loyalty program covers Progression too. Codes only in Marketing; LiveOps frequency and the Creators
  // program settings live inside the Campaigns and Creators pages, not as menu items.
  // OFF — sections the prototype's story doesn't use: they stay in the menu (the navigation is part of the idea), softly
  // greyed, with our tooltip, not clickable (Daria, 27.09: show only what the logic needs now, block the rest).
  // Nothing behind them is deleted — the pages, cards and tasks are all still there; drop OFF to open one again.
  // Open now: the four scenarios — onboarding, the Halloween event (Bundles, Daily rewards, Hub, Campaigns), the hub
  // builder, Home with its signals (fixing items in Items) — and Transactions (Newton's revenue answer opens it).
  const OFF = 1;
  const NAVS = {
    dashboard: [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'analytics', label: 'Analytics', icon: 'chart', items: [['analytics-reports', 'Reports', OFF], ['analytics-transactions', 'Transactions']] },
      { id: 'store', label: 'Store', icon: 'store', items: [['store', 'Items'], ['store-bundles', 'Bundles'], ['store-offers', 'Offers', OFF], ['store-promotions', 'Promotions', OFF], ['store-currencies', 'Currencies', OFF], ['store-subscriptions', 'Subscriptions', OFF], ['store-loot-boxes', 'Loot boxes', OFF]] },
      { id: 'marketing', label: 'Marketing', icon: 'mega', items: [['marketing-campaigns', 'Campaigns'], ['marketing-creators', 'Creators', OFF], ['marketing-codes', 'Codes', OFF]] },
      { id: 'engagement', label: 'Engagement', icon: 'heart', items: [['engagement-daily-rewards', 'Daily rewards'], ['engagement-loyalty', 'Loyalty program', OFF], ['engagement-leaderboards', 'Leaderboards', OFF], ['engagement-achievements', 'Achievements', OFF], ['engagement-daily-quiz', 'Daily quiz', OFF]] },
      { id: 'players', label: 'Players', icon: 'users', off: true, items: [['players-segments', 'Segments', OFF], ['players-profiles', 'Profiles', OFF], ['players-attributes', 'Attributes', OFF]] }
    ]
  };
  const navOff = (r) => NAVS.dashboard.some((g) => g.items && g.items.some(([k, , off]) => k === r && off));
  const navRoute = (mode) => location.hash.slice(1) || NAVS[mode][0].id;
  const navGroup = (mode, r) => NAVS[mode].find((g) => g.items && g.items.some(([k]) => k === r));
  const navLabel = (mode, r) => { for (const g of NAVS[mode]) { if (g.id === r && !g.items) return g.label; const it = g.items && g.items.find(([k]) => k === r); if (it) return it[1]; } return ''; };
  const navCount = () => '';   // no counters in the sidebar (Daria, 28.09: "1" by Marketing read as "one is running"); was a .nav-count badge
  const sideOpen = {}; // groups the person opened or closed by hand
  /* A group is open if the person opened it by hand, else when the current page is inside it. */
  const navOpen = (g, r) => sideOpen[g.id] ?? g.items.some(([k]) => k === r);
  /* was — open state of each group as it is on screen now: the sidebar is drawn with it first and then
     switched to the new one, so groups fold and unfold smoothly instead of jumping (Daria, 27.09). */
  function sidebar(mode, r, counts, was = {}) {
    const cur = (k) => (k === r ? ' aria-current="page"' : '');
    const lab = (t) => `<span class="nav-label">${t}</span>`;
    return NAVS[mode].map((g) => {
      if (!g.items) return `<a class="ag-nav-item${g.id === r ? ' is-active' : ''}" href="#${g.id}" title="${g.label}"${cur(g.id)}>${icon(g.icon)}${lab(g.label)}${navCount(counts[g.id])}</a>`;
      if (g.off) return `<span class="ag-nav-item" aria-disabled="true" data-proto-tip="${DRY}" aria-label="${g.label}">${icon(g.icon)}${lab(g.label)}</span>`;
      const open = g.id in was ? was[g.id] : navOpen(g, r);
      const total = g.items.reduce((n, [k]) => n + (counts[k] || 0), 0);
      return `<button class="ag-nav-item${g.items.some(([k]) => k === r) ? ' is-here' : ''}" type="button" title="${g.label}" data-group="${g.id}" aria-expanded="${open}" aria-controls="nav-${g.id}">${icon(g.icon)}${lab(g.label)}${navCount(total)}${icon('chev', 'ag-nav-item__chev')}</button>
        <div class="ag-nav-sub${open ? '' : ' is-shut'}" id="nav-${g.id}"><div class="ag-nav-sub__in">${g.items.map(([k, l, off]) => (off
          ? `<span class="nav-off" aria-disabled="true" data-proto-tip="${DRY}" aria-label="${l}">${l}</span>`
          : `<a href="#${k}" class="${k === r ? 'is-active' : ''}"${cur(k)}${open ? '' : ' tabindex="-1"'}>${l}${navCount(counts[k])}</a>`)).join('')}</div></div>`;
    }).join('');
  }
  // counts: () => ({ routeId: number }) — small blue counters next to items
  function mountSidebar(mode, counts = () => ({})) {
    const el = $('#side');
    const draw = () => {
      const r = navRoute(mode), was = {};
      $$('[data-group]', el).forEach((b) => { was[b.dataset.group] = b.getAttribute('aria-expanded') === 'true'; });
      el.innerHTML = sidebar(mode, r, counts(), was);
      if (!Object.keys(was).length) return;
      void el.offsetHeight;   // draw as it was, then switch — the fold animates (app.css, sidebar)
      NAVS[mode].filter((g) => g.items && !g.off).forEach((g) => {
        const open = navOpen(g, r); if (open === was[g.id]) return;
        $(`[data-group="${g.id}"]`, el).setAttribute('aria-expanded', String(open));
        const sub = $(`#nav-${g.id}`, el); sub.classList.toggle('is-shut', !open);
        $$('a', sub).forEach((a) => { if (open) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
      });
    };
    el.addEventListener('click', (e) => {
      /* a folded column opens on any item — also the page you're on (Home), whose address doesn't change (Daria, 28.09) */
      const link = e.target.closest('a'); if (link && document.body.classList.contains('side-collapsed')) sideToggle(false);
      const b = e.target.closest('[data-group]'); if (!b) return;
      if (document.body.classList.contains('side-collapsed')) { sideToggle(false); sideOpen[b.dataset.group] = true; draw(); return; }
      sideOpen[b.dataset.group] = b.getAttribute('aria-expanded') !== 'true';
      draw(); $(`[data-group="${b.dataset.group}"]`, el).focus();
    });
    window.addEventListener('hashchange', () => { const g = navGroup(mode, navRoute(mode)); if (g) delete sideOpen[g.id]; draw(); });
    document.addEventListener('ag:change', draw);
    draw();
  }

  /* ---------- Newton split panel (width states: minimal / moderate / wide / two-thirds / full, plus solo) ---------- */
  /* The system picks the state per context — pages call mountChat again with a new state, nothing here is user-draggable.
     opts: state, body, foot, rail (what the narrow rail says), back (state the rail reopens into). */
  function mountChat(el, opts = {}) {
    const state = opts.state || 'moderate';
    el.dataset.nw = state;
    // no frame round the panel either (Daria, 28.09: the line of his colours — class nw-edge — is off, like the waves, nw-aurora)
    el.innerHTML = `
      <button class="nw-chat__rail" data-nw-expand aria-label="Open Newton">${nwIcon()}${opts.rail ? `<span>${opts.rail}</span>` : ''}</button>
      <div class="nw-chat__full">
        <div class="nw-chat__head"><b>Newton</b>${nwIcon()}</div>   <!-- no fold button for now (Daria, 27.09): the width follows the work by itself -->
        <div class="nw-chat__body">${opts.body || ''}</div>
        ${opts.foot ? `<div class="nw-chat__foot">${opts.foot}</div>` : ''}
      </div>`;
    const back = opts.back || (state === 'minimal' ? 'moderate' : state);
    $('[data-nw-expand]', el).addEventListener('click', () => { el.dataset.nw = back; });
    const collapse = $('[data-nw-collapse]', el); if (collapse) collapse.addEventListener('click', () => { el.dataset.nw = 'minimal'; });
    const body = $('.nw-chat__body', el); if (opts.toBottom && body) body.scrollTop = body.scrollHeight;
  }

  /* ---------- the left column (Dashboard sidebar, Hub pages): collapses on its own while you work with
     Newton, so the chat gets the room; a click on a section opens it again and wins until the next automatic change.
     No toggle button: the column never disappears and opens by itself (Daria, 26.09) ---------- */
  const BIG = ['half', 'two-thirds', 'full'];
  const side = { auto: false, manual: null };
  const sideApply = () => document.body.classList.toggle('side-collapsed', side.manual != null ? side.manual : side.auto);
  function sideAuto(collapsed) { if (collapsed !== side.auto) { side.auto = collapsed; side.manual = null; } sideApply(); }
  /* a manual fold/unfold is news for the Newton panel: opening the sidebar asks for the page back (newton.js) */
  function sideToggle(force) {
    side.manual = force != null ? force : !document.body.classList.contains('side-collapsed'); sideApply();
    document.dispatchEvent(new CustomEvent('ag:side', { detail: { collapsed: side.manual } }));
  }

  /* ---------- motion: whatever opens and closes with `hidden` eases in and out (Daria, 27.09) ----------
     Menus, the two windows, the item form, toast, the field over a selected block in Hub. Pages keep toggling
     `hidden` as before: an observer adds anim-in on open and anim-out on close (the element stays drawn
     until its exit finishes, `hidden` is already true, so every check in the code sees it closed).
     Elements drawn open by a redraw don't animate — only a real open does. Styles: app.css, «motion». */
  const MOTION = '.ag-menu, .ag-backdrop, .drawer-bg, .toast-wrap, .ctx, .ob-show';
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moT = new WeakMap();
  function enter(el, cls = 'anim-in', ms = 320) {
    if (!el || still()) return;
    clearTimeout(moT.get(el)); el.classList.remove('anim-in', 'anim-out', cls);
    if (!el.hidden) el.style.setProperty('--mo-disp', getComputedStyle(el).display);   // how to keep it drawn while it leaves
    void el.offsetWidth; el.classList.add(cls);
    moT.set(el, setTimeout(() => el.classList.remove(cls), ms));
  }
  function leave(el) {
    if (still()) return;
    clearTimeout(moT.get(el)); el.classList.remove('anim-in'); el.classList.add('anim-out');
    moT.set(el, setTimeout(() => el.classList.remove('anim-out'), 200));
  }
  /* a new page inside Dashboard or Hub: the old one fades out as the new one fades up (a view transition where the
     browser has it; otherwise just the fade-up). update — what redraws the page; el — the page area. */
  const pageIn = (el) => enter(el, 'page-in', 300);
  function swap(update, el) {
    if (still() || !document.startViewTransition || !el) { update(); if (el) pageIn(el); return; }
    el.style.viewTransitionName = 'ag-page';
    const t = document.startViewTransition(update);
    t.ready.catch(() => {});   // skipped (a hidden tab, a newer transition): the page still updates, just without the fade
    t.finished.catch(() => {}).finally(() => { el.style.viewTransitionName = ''; });
  }
  /* to another page of the prototype (Dashboard ↔ Hub, onboarding → Dashboard): the work area fades out, the next page
     fades it in (app.css, .app__body) — the header stays, so it reads as one app, not a reload. Works from a file too. */
  function go(url) {
    if (still()) { location.href = url; return; }
    document.documentElement.classList.add('is-leaving');
    setTimeout(() => { location.href = url; }, 150);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname) return;   // same page: just a new #section
    e.preventDefault(); go(u.href);
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) document.documentElement.classList.remove('is-leaving'); });   // back button
  new MutationObserver((recs) => recs.forEach((r) => {
    const el = r.target; if (!el.matches || !el.matches(MOTION)) return;
    const was = r.oldValue !== null;
    if (was && !el.hidden) enter(el); else if (!was && el.hidden) leave(el);
  })).observe(document.documentElement, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true, subtree: true });

  /* ---------- toast ---------- */
  let toastT = null;
  function toast(text) {
    let t = $('#ag-toast');
    if (!t) {
      document.body.insertAdjacentHTML('beforeend', `<div class="toast-wrap" id="ag-toast" hidden><div class="ag-toast" role="status">${icon('check')}<span></span></div></div>`);
      t = $('#ag-toast');
    }
    $('span', t).textContent = text; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- magic: where Newton just made something (Daria, 28.09, after Aceternity's Dotted Glow Background) ----------
     A soft-edged field of dots lies over the block and a little past its edges: a regular grid, each dot breathing in its
     own rhythm, the brightest glowing in Newton's colours; under it the block is softly blurred — something is being made.
     Then the dots go out in a wave from the middle and the block is there, sharp.
     AG.magic(el, { key, dark }): key — fire once per event even if the page redraws; dark — light dots for a dark game theme.
     The field sits in a host that pages don't redraw ([data-magic-host]: the Dashboard page area, the hub canvas),
     so it keeps playing when the list under it is drawn again. Nothing for people who turned motion off. */
  /* a celebration: bits burst out of a point and fall — pumpkins, candy, ghosts for the Halloween event (Daria, 27.09).
     Colours are kit tokens; nothing for people who turned motion off. */
  function confetti(x, y, bits = ['🎃', '🍬', '👻', '🦇', '🍭', '✨']) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
    const tones = ['var(--color-fg-brand-primary)', 'var(--color-fg-warning-solid)', 'var(--color-fg-pink-secondary)', 'var(--color-fg-violet-secondary)', 'var(--color-fg-lime-secondary)'];
    for (let i = 0; i < 54; i++) {
      const s = document.createElement('span'), emoji = i % 3 !== 2;
      if (emoji) s.textContent = bits[i % bits.length]; else { s.className = 'confetti__bit'; s.style.background = tones[i % tones.length]; }
      s.style.cssText += `;left:${x}px;top:${y}px;--dx:${Math.round((Math.random() - .5) * 760)}px;--dy:${-Math.round(260 + Math.random() * 420)}px;--r:${Math.round((Math.random() - .5) * 720)}deg;--d:${(1.5 + Math.random() * .9).toFixed(2)}s;font-size:${Math.round(18 + Math.random() * 18)}px`;
      box.appendChild(s);
    }
    setTimeout(() => box.remove(), 2800);
  }
  const magicSeen = {};
  function magic(el, o = {}) {
    if (!el || !el.isConnected) return;
    if (o.key) { if (magicSeen[o.key]) return; magicSeen[o.key] = true; }
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = el.closest('[data-magic-host]') || (el.tagName === 'TR' ? el.closest('.table-card') : el.parentElement || el);
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const h = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pad = Math.round(Math.max(12, Math.min(40, Math.min(r.width, r.height) * .35)));   // a row spills a little, a card more
    const W = Math.round(r.width + pad * 2), H = Math.round(r.height + pad * 2);
    const fx = document.createElement('span');
    fx.className = 'magic' + (o.dark ? ' magic--dark' : '');
    fx.setAttribute('aria-hidden', 'true');
    Object.assign(fx.style, { left: `${r.left - h.left + host.scrollLeft - host.clientLeft - pad}px`, top: `${r.top - h.top + host.scrollTop - host.clientTop - pad}px`, width: `${W}px`, height: `${H}px` });
    /* soft edges: the field fades out towards its rim (a round-cornered radial fade) */
    const mask = `radial-gradient(${Math.round(50 + pad / W * 100)}% ${Math.round(50 + pad / H * 100)}% at 50% 50%, black 62%, transparent 100%)`;
    const haze = document.createElement('span'); haze.className = 'magic__haze';
    const cv = document.createElement('canvas');
    [haze, cv].forEach((n) => { n.style.webkitMaskImage = n.style.maskImage = mask; });
    fx.append(haze, cv); host.appendChild(fx);
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement), tok = (n) => css.getPropertyValue(n).trim();
    const ink = o.dark ? tok('--color-fg-primary') : tok('--color-text-tertiary');
    const glows = [tok('--color-fg-brand-primary-hover'), tok('--color-fg-pink-primary'), tok('--color-fg-violet-secondary')];
    /* the grid: a dot every 11px, each with its own speed and phase; a few are "hot" and glow when they peak */
    const GAP = 11, cx = W / 2, cy = H / 2, far = Math.hypot(cx, cy);
    const dots = [];
    for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) {
      dots.push({ x, y, ph: Math.random() * 6.283, sp: 0.4 + Math.random() * 0.9, hot: Math.random() < 0.14, g: glows[Math.floor(Math.random() * glows.length)], d: Math.hypot(x - cx, y - cy) / far });
    }
    el.classList.remove('magic-in'); void el.offsetWidth; el.classList.add('magic-in');
    const IN = 240, HOLD = 900, OUT = 700, t0 = performance.now();
    let leaving = false;
    /* follow the thing every frame (Daria, 28.09: in tables the dots lit up off the row): it's measured while the new page
       still slides in, so a place taken once is wrong a moment later */
    const place = () => { const hh = host.getBoundingClientRect(), rr = el.getBoundingClientRect();
      fx.style.left = `${rr.left - hh.left + host.scrollLeft - host.clientLeft - pad}px`; fx.style.top = `${rr.top - hh.top + host.scrollTop - host.clientTop - pad}px`; };
    const frame = (now) => {
      const t = now - t0;
      if (t > IN + HOLD + OUT || !fx.isConnected || !el.isConnected) { fx.remove(); el.classList.remove('magic-in'); return; }
      place();
      if (t > IN + HOLD && !leaving) { leaving = true; fx.classList.add('is-leaving'); }
      const k = leaving ? (t - IN - HOLD) / OUT : 0;
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        /* going out: a wave from the middle to the rim */
        const off = leaving ? Math.min(1, Math.max(0, (k * 1.6 - d.d * 0.6) / 0.4)) : 0;
        const on = Math.min(1, t / IN) * (1 - off);
        if (on <= 0) continue;
        const pulse = 0.5 + 0.5 * Math.sin(d.ph + (t / 1000) * d.sp * 3);
        const a = (0.12 + 0.6 * pulse) * on;
        if (d.hot && pulse > 0.7) {
          ctx.globalAlpha = Math.min(1, a * 1.3); ctx.fillStyle = d.g; ctx.shadowColor = d.g; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(d.x, d.y, 1.6, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        } else {
          ctx.globalAlpha = a; ctx.fillStyle = ink;
          ctx.beginPath(); ctx.arc(d.x, d.y, 1.1, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- morph: one look melts into the next (Daria, 28.09, after React Bits' Morph Slider, "melt") ----------
     The hub changes its whole style (a style tag, the dice): the old look, copied, lies over the new one and melts away along
     a noise pattern, rippling as it goes; the new look settles out of the same ripple. Browser filters (SVG turbulence and
     displacement), no library. AG.morph(stage, oldNodes): stage — the element redrawn, oldNodes — copies of its children made
     just before the redraw. Nothing for people who turned motion off. */
  function meltDefs() {
    if (document.getElementById('ag-melt')) return;
    document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
      <filter id="ag-melt" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 1" result="m"/>
        <feComposite in="d" in2="m" operator="in"/></filter>
      <filter id="ag-melt-in" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`);
  }
  /* AG.morph(page, oldCopy): page — the element just redrawn (the hub page), oldCopy — a copy of it made before the redraw.
     Only the page melts, inside its own edges (Daria, 28.09: the panel and the window melted too): the copy lies exactly over
     the page, clipped to it; the new page's content (not its box) settles out of the ripple. */
  function morph(page, old) {
    if (!page || !old || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    meltDefs();
    const host = page.parentElement; if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const cs = getComputedStyle(page);
    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    const r = page.getBoundingClientRect(), hr = host.getBoundingClientRect();   // real on-screen size (the page may be zoomed to fit)
    ghost.style.cssText = `position:absolute;z-index:2;pointer-events:none;overflow:hidden;left:${r.left - hr.left + host.scrollLeft}px;top:${r.top - hr.top + host.scrollTop}px;width:${r.width}px;height:${r.height}px;border-radius:${cs.borderRadius}`;
    old.removeAttribute('id'); old.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    Object.assign(old.style, { position: 'absolute', left: '0', top: '0', margin: '0', filter: 'url(#ag-melt)' });
    ghost.appendChild(old); host.appendChild(ghost);
    const out = document.getElementById('ag-melt'), inn = document.getElementById('ag-melt-in');
    const seed = String(1 + Math.floor(Math.random() * 90));
    [out, inn].forEach((f) => f.querySelector('feTurbulence').setAttribute('seed', seed));
    const dOut = out.querySelector('feDisplacementMap'), mat = out.querySelector('feColorMatrix'), dIn = inn.querySelector('feDisplacementMap');
    const fresh = [...page.children];
    fresh.forEach((n) => { n.style.filter = 'url(#ag-melt-in)'; });
    const D = 720, t0 = performance.now(), ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / D), e = ease(p);
      dOut.setAttribute('scale', (Math.sin(Math.PI * e) * 160 + e * 70).toFixed(1));   // the old look ripples more as it melts (stronger, Daria 28.09)
      mat.setAttribute('values', `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 ${(1 - 5.2 * e).toFixed(3)}`);   // …and goes along the noise
      dIn.setAttribute('scale', (Math.pow(1 - e, 2) * 110).toFixed(1));                  // the new one settles out of the ripple
      if (p < 1 && ghost.isConnected) { requestAnimationFrame(frame); return; }
      ghost.remove(); fresh.forEach((n) => { n.style.filter = ''; });
    };
    requestAnimationFrame(frame);
  }

  /* AG.meltIn(el): a new thing settles out of a ripple — the hub's style change, made small for a table row (Daria, 28.09:
     the dots and the blur looked cheap). Its cells come in through a moving wave of their own noise that calms down, the
     row fades in with it. No dots, no haze over the neighbours. */
  let meltN = 0;
  const meltSeen = {};
  function meltIn(el, o = {}) {
    if (!el || !el.isConnected) return;
    if (o.key) { if (meltSeen[o.key]) return; meltSeen[o.key] = true; }
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = `ag-melt-row-${++meltN}`;
    document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false" data-melt="${id}">
      <filter id="${id}" x="-5%" y="-40%" width="110%" height="180%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.06" numOctaves="2" seed="${1 + Math.floor(Math.random() * 90)}" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`);
    const svg = document.querySelector(`[data-melt="${id}"]`), map = svg.querySelector('feDisplacementMap'), turb = svg.querySelector('feTurbulence');
    /* a row comes in left to right, cell after cell (Daria, 28.09); something that was already there (a hub block, a card
       redrawn) doesn't fade, it only ripples and settles */
    const parts = el.tagName === 'TR' ? [...el.children] : [el], fade = o.fade != null ? o.fade : el.tagName === 'TR', LAG = 90;
    parts.forEach((n) => { n.style.filter = `url(#${id})`; if (fade) n.style.opacity = '0'; });
    const D = 1100, total = D + LAG * (parts.length - 1), t0 = performance.now(), out = (x) => 1 - Math.pow(1 - x, 3);
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / total), e = out(p);
      map.setAttribute('scale', ((1 - e) * (fade ? 46 : 30)).toFixed(1));
      turb.setAttribute('baseFrequency', `${(0.028 - 0.01 * e).toFixed(4)} ${(0.06 - 0.02 * e).toFixed(4)}`);   // the ripple drifts as it calms
      if (fade) parts.forEach((n, i) => { n.style.opacity = Math.max(0, Math.min(1, (now - t0 - i * LAG) / 420)).toFixed(3); });
      if (p < 1 && el.isConnected) { requestAnimationFrame(frame); return; }
      parts.forEach((n) => { n.style.filter = ''; n.style.opacity = ''; }); svg.remove();
    };
    requestAnimationFrame(frame);
  }

  /* ---------- modal plumbing ---------- */
  let lastFocus = null;
  function open(el) { lastFocus = document.activeElement; el.hidden = false; const f = $('input, button:not([data-close])', el) || $('button', el); if (f) f.focus(); }
  function close(el) { el.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function mountModal(id, html) {
    let el = document.getElementById(id);
    if (!el) {
      document.body.insertAdjacentHTML('beforeend', html);
      el = document.getElementById(id);
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(el); });
    }
    return el;
  }

  /* ---------- Verify your company (wizard) ---------- */
  const VERIFY_STEPS = ['Company', 'Legal details', 'Signatory', 'Owner'];
  function verifyHTML() {
    return `<div class="ag-backdrop" id="m-verify" hidden>
      <div class="ag-modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="vTitle">
        <div class="ag-modal__head">
          <div class="mhead"><h2 class="ag-modal__title" id="vTitle">Verify your company</h2><button class="ag-btn ag-btn--tertiary ag-btn--icon ag-btn--sm" data-close aria-label="Close">${icon('x')}</button></div>
          <p class="text-paragraph-sm text-secondary" id="vLead"></p>
          <ol class="steps" id="vSteps"></ol>
        </div>
        <div class="ag-modal__body" id="vBody"></div>
        <div class="ag-modal__foot" id="vFoot"></div>
      </div></div>`;
  }
  let vView = 1;
  function renderVerify() {
    const el = $('#m-verify'); if (!el) return;
    const v = state.verify;
    const status = v.status;
    if (status === 'review' || status === 'approved') {
      const ok = status === 'approved';
      $('#vLead').textContent = ok ? 'Publishing and payments are on for all games of Raider Games Ltd.' : 'We check the details and email you if anything needs changes. Until then, only publishing and payments wait.';
      $('#vSteps').innerHTML = [['Submitted', 'today'], ['In review', ok ? 'done' : 'now'], ['Changes needed', 'only if needed'], ['Approved', ok ? 'today' : '']]
        .map((s, i) => `<li class="${i === 0 || (ok && i !== 2) ? 'is-done' : (!ok && i === 1 ? 'is-active' : '')}">${s[0]}<small>${s[1]}</small></li>`).join('');
      $('#vBody').innerHTML = ok
        ? ''   // the lead already says it: publishing and payments are on
        : `<div><button class="proto-btn" data-v="approve">Prototype: approve verification</button></div>`;
      $('#vFoot').innerHTML = `<span class="ag-hint">You'll also find this in Company → Verification.</span><span class="ag-spacer"></span><button class="ag-btn ag-btn--primary" data-close>Done</button>`;
      return;
    }
    $('#vLead').textContent = 'Once for all your games. While we check it, you can keep working — only publishing and payments wait for it.';
    $('#vSteps').innerHTML = VERIFY_STEPS.map((s, i) => `<li class="${i + 1 < vView ? 'is-done' : i + 1 === vView ? 'is-active' : ''}">${s}</li>`).join('');
    if (vView === 1) {
      const nameAi = !state.edited.vName, urlAi = !state.edited.vUrl;
      $('#vBody').innerHTML = `
        <div class="ag-field"><label class="ag-label" for="vName">Company name</label>
          <div class="nf"><input class="ag-input" id="vName" data-track="vName" value="Raider Games Ltd.">${nameAi ? nwIcon('Filled by Newton from your App Store page') : ''}</div>
          <span class="ag-hint">Use the name your team will recognize.</span></div>
        <div class="ag-field"><label class="ag-label" for="vUrl">Website or store link</label>
          <div class="nf"><input class="ag-input" id="vUrl" data-track="vUrl" value="https://apps.apple.com/app/pixel-raiders/id6450012345">${urlAi ? nwIcon('Filled by Newton from your App Store page') : ''}</div></div>
        <div class="ag-field"><span class="ag-label">Logo</span>
          <div class="logo-row"><span class="game-ico game-ico--lg"></span><span>Game icon from the App Store</span>${nwIcon('Filled by Newton')}</div></div>`;
      $('#vFoot').innerHTML = `<span class="ag-hint">Saved as you go</span><span class="ag-spacer"></span><button class="ag-btn ag-btn--tertiary" data-close>Close</button><button class="ag-btn ag-btn--primary" data-v="next">Next: Legal details</button>`;
    } else {
      $('#vBody').innerHTML = `<div class="proto-note">Prototype: steps 2–4 aren't drawn. In the product they ask for legal details (legal business name, TIN, registered address, business phone), the person who signs the agreement, and owners with 25% or more. Then “Submit for review”.</div>
        <div><button class="proto-btn" data-v="submit">Prototype: fill in the rest and submit</button></div>`;
      $('#vFoot').innerHTML = `<span class="ag-hint">Saved as you go</span><span class="ag-spacer"></span><button class="ag-btn ag-btn--tertiary" data-v="back">Back</button><button class="ag-btn ag-btn--primary" data-close>Close</button>`;
    }
  }
  function openVerify() {
    const el = mountModal('m-verify', verifyHTML());
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('input', (e) => {
        const k = e.target.dataset.track; if (!k || state.edited[k]) return;
        save({ edited: Object.assign({}, state.edited, { [k]: true }) });
        const ai = $('.ai-ico', e.target.parentNode); if (ai) ai.remove(); // Newton's mark goes away after a manual edit
      });
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-v]'); if (!a) return;
        const v = state.verify;
        if (a.dataset.v === 'next') { save({ verify: { step: Math.max(v.step, 1), status: 'draft' } }); vView = 2; renderVerify(); toast('Company details saved'); }
        if (a.dataset.v === 'back') { vView = 1; renderVerify(); }
        if (a.dataset.v === 'submit') { save({ verify: { step: VERIFY_TOTAL, status: 'review' } }); renderVerify(); toast('Sent for review'); }
        if (a.dataset.v === 'approve') { save({ verify: { step: VERIFY_TOTAL, status: 'approved' } }); renderVerify(); toast('Company verified'); }
      });
    }
    vView = state.verify.step >= 1 ? 2 : 1;
    renderVerify(); open(el);
  }

  /* ---------- Connect your game ---------- */
  const CHECKS = [
    ['To sell', 'Player verification', 'Checks a player when they log in to the hub', 'player.verify'],
    ['To sell', 'Item add', 'Delivers a purchased item to the player', 'item.add'],
    ['To sell', 'Item remove', 'Removes an item after a refund', 'item.remove'],
    ['So players find your hub', 'Log in from the game', 'One tap from the game, no Player ID to look up', 'Waiting for the first login'],
    ['So players find your hub', 'Link to the hub in the game', 'A button in the game that opens your hub', 'Waiting for the first visit']
  ];
  function connectHTML() {
    return `<div class="ag-backdrop" id="m-connect" hidden>
      <div class="ag-modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="cTitle">
        <div class="ag-modal__head">
          <div class="mhead"><h2 class="ag-modal__title" id="cTitle">Connect your game</h2><button class="ag-btn ag-btn--tertiary ag-btn--icon ag-btn--sm" data-close aria-label="Close">${icon('x')}</button></div>
          <p class="text-paragraph-sm text-secondary">So purchases reach players in the game, and players can find your hub.</p>
        </div>
        <div class="ag-modal__body">
          <div class="ag-field"><label class="ag-label" for="cEndpoint">Your server endpoint</label>
            <input class="ag-input" id="cEndpoint" placeholder="https://your-server.com/aghanim/webhook">
            <span class="ag-hint">Aghanim sends game events here.</span></div>
          <div class="sec"><span class="sec__title">Set up with Claude Code or Cursor</span>
            <p class="text-paragraph-sm text-secondary">Run this command in your editor. Newton walks your AI assistant through the setup.</p>
            <div class="code"><code>/aghanim-webhooks-quick-start</code><button class="ag-btn ag-btn--outline ag-btn--xs" data-copy>Copy</button></div>
            <div class="code"><span>Test key</span><code>sk_sandbox_••••••••4f2a</code><button class="ag-btn ag-btn--outline ag-btn--xs" data-copy>Copy</button></div>
            <a class="ag-btn ag-btn--tertiary ag-btn--sm" href="https://docs.aghanim.com" target="_blank" rel="noopener" style="align-self:flex-start">Prefer to do it by hand? Read the guide</a></div>
          <div class="checks" id="cChecks"></div>
          <div><button class="proto-btn" data-c="sim">Prototype: simulate the next event</button></div>
        </div>
        <div class="ag-modal__foot"><span class="ag-hint">You can close this. Home keeps the status. Later you can change it in Settings → Webhooks.</span><span class="ag-spacer"></span><button class="ag-btn ag-btn--primary" data-close>Done</button></div>
      </div></div>`;
  }
  function renderConnect() {
    const el = $('#m-connect'); if (!el) return;
    const groups = ['To sell', 'So players find your hub'];
    $('#cChecks').innerHTML = groups.map((g) => `<div><div class="text-section-label">${g}</div>${CHECKS.map((c, i) => c[0] !== g ? '' : `
      <div class="crow${i < state.connect ? ' is-ok' : ''}"><span class="crow__st">${i < state.connect ? icon('check') : '<span class="dot"></span>'}</span>
        <div class="crow__txt"><b>${c[1]}</b><span>${c[2]}</span></div>
        <span class="crow__status">${i < state.connect ? 'Received' : (i < 3 ? 'Waiting for the first event' : c[3])}</span></div>`).join('')}</div>`).join('');
    $('[data-c="sim"]', el).hidden = state.connect >= CONNECT_TOTAL;
  }
  function openConnect() {
    const el = mountModal('m-connect', connectHTML());
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-c="sim"]')) { save({ connect: Math.min(CONNECT_TOTAL, state.connect + 1) }); renderConnect(); }
        const cp = e.target.closest('[data-copy]');
        if (cp) { try { navigator.clipboard && navigator.clipboard.writeText(cp.previousElementSibling.textContent); } catch (err) { /* optional */ } cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1200); }
      });
      $('#cEndpoint', el).addEventListener('input', (e) => save({ endpoint: e.target.value }));
    }
    $('#cEndpoint', el).value = state.endpoint;
    renderConnect(); open(el);
  }

  /* ---------- the hub as players see it: a browser window over the blurred screen, the real hub inside ----------
     One component (Daria, 27.09): "See my hub" in onboarding and Preview in Hub. The page at its real width
     (desktop 1280, tablet 768, phone 375) scaled to the window, as tall as the page — the window scrolls it, nothing
     to click. Close: the cross or Esc (closeAttr lets a page handle the cross itself — onboarding goes Back). */
  const SHOW_W = { desktop: 1280, tablet: 768, phone: 375 };
  function fitShow() {
    const el = $('.ob-show'), box = $('.ob-show__page'), f = $('.ob-show__frame'); if (!el || !box || !f) return;
    const w = SHOW_W[el.dataset.dev] || 1280, k = box.clientWidth / w;
    let h = 900;
    try { const fr = f.contentDocument && f.contentDocument.querySelector('#stage .hub-frame'); if (fr) { fr.style.minHeight = '0'; h = Math.max(700, fr.scrollHeight); } } catch (e) { /* not ready */ }
    Object.assign(f.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${k})` });
    box.style.height = `${Math.ceil(h * k)}px`;
  }
  function showHub({ page = 'home', path = '', device = 'desktop', badge = '', foot = '', closeAttr = 'data-show-close', scroll = 0 } = {}) {
    if ($('.ob-show')) return;
    /* only the hub itself (Daria, 28.09): no browser bar, no strip under it — the close button beside the window, the way on
       under it; behind it, over the fog, a slow burst of Newton's light (after React Bits' Prismatic Burst) */
    document.body.insertAdjacentHTML('beforeend', `<div class="ob-show ob-show--${device}" data-dev="${device}" role="dialog" aria-modal="true" aria-label="Your hub">
      <div class="ob-burst" aria-hidden="true"><i></i><i></i></div>
      <div class="ob-show__box">
        <div class="ob-show__win">
          <div class="ob-show__view"><div class="ob-show__page"><iframe class="ob-show__frame" src="Hub.html?embed=${device}&page=${page}" tabindex="-1" aria-hidden="true" title="Your hub"></iframe><div class="ob-show__shield"></div></div></div>
          <button class="ob-show__x" ${closeAttr} aria-label="Close">${icon('x')}</button>
        </div>
        ${foot ? `<div class="ob-show__foot">${foot}</div>` : ''}
      </div>
    </div>`);
    const el = $('.ob-show'); enter(el);
    const f = $('.ob-show__frame');
    f.addEventListener('load', () => {
      [150, 600, 1500].forEach((t) => setTimeout(fitShow, t));
      // no "Newton made this" shimmer over the hub: it's built already, here we just look at it (Daria, 28.09)
      setTimeout(() => { const v = $('.ob-show__view'); if (v && scroll) v.scrollTo({ top: scroll, behavior: 'smooth' }); }, 900);
    });
    el.addEventListener('click', (e) => { if (e.target.closest('[data-show-close]') || e.target === el) closeHub(); });
    fitShow();
  }
  function closeHub() { const el = $('.ob-show'); if (el) { el.classList.add('anim-out'); setTimeout(() => el.remove(), 200); } }
  window.addEventListener('resize', fitShow);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('.ob-show')) { const x = $('.ob-show__x'); if (x) x.click(); } });

  /* ---------- item form (one form for Store table, hub canvas and Newton results) ---------- */
  function openItem(id) {
    const it = (typeof id === 'object' ? id : items.find((x) => x.id === id)) || { id, name: 'Starter Pack', sub: '500 gems · 3 hero shards', price: '$4.99', sku: 'offer_starter_01' };
    let el = $('#m-item');
    if (!el) {
      document.body.insertAdjacentHTML('beforeend', `<div class="drawer-bg" id="m-item" hidden><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="iTitle">
        <div class="drawer__head"><div class="mhead"><h2 class="ag-modal__title" id="iTitle"></h2><button class="ag-btn ag-btn--tertiary ag-btn--icon ag-btn--sm" data-close aria-label="Close">${icon('x')}</button></div>
          <p class="text-paragraph-sm text-secondary">Changes apply everywhere this item is shown.</p><div id="iSrc"></div></div>
        <div class="drawer__body" id="iBody"></div>
        <div class="drawer__foot"><a class="ag-btn ag-btn--tertiary" href="Dashboard.html#store">Open in Store</a><span class="ag-spacer"></span><button class="ag-btn ag-btn--tertiary" data-close>Cancel</button><button class="ag-btn ag-btn--primary" data-item-save>Save</button></div>
      </aside></div>`);
      el = $('#m-item');
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.closest('[data-close]')) close(el);
        if (e.target.closest('[data-item-save]') && el._onSave) {   // a new one by hand: it needs a name, then lands as a draft
          const v = { name: $('#iName').value.trim(), price: $('#iPrice').value.trim(), sub: $('#iSub').value.trim(), sku: $('#iSku').value.trim() };
          if (!v.name) { $('#iName').focus(); return; }
          close(el); el._onSave(v); return;
        }
        if (e.target.closest('[data-item-save]')) {
          const changed = $$('input', el).some((i) => i.value !== i.defaultValue);
          if (changed) save({ edited: Object.assign({}, state.edited, { [el.dataset.id]: true }) });
          close(el); toast(changed ? 'Saved. Made by you now, so the Newton mark is gone.' : 'No changes');
        }
      });
    }
    el.dataset.id = it.id;
    el._onSave = it.onSave || null;   // new, made by hand (not Newton): the page says where it goes
    $('#iTitle').textContent = it.title || it.name;
    $('#iSrc').innerHTML = byNewton(it.id) ? `<span class="nw-label">${nwIcon()}Made by Newton from your App Store page</span>` : '';
    const f = (id, label, val, hint = '') => `<div class="ag-field"><label class="ag-label" for="${id}">${label}</label><input class="ag-input" id="${id}" value="${val}">${hint ? `<span class="ag-hint">${hint}</span>` : ''}</div>`;
    $('#iBody').innerHTML = f('iName', 'Name', it.name) + f('iPrice', 'Price', it.price, 'Rounded by your price template') + f('iSub', 'Contents', it.sub)
      + f('iSku', 'Item in your game (SKU)', it.sku, it.sku ? '' : 'Link it to an item in your game, otherwise the purchase can’t be delivered.');
    open(el);
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('afterbegin', sprite);
    /* Every page gets this for free: when the Newton panel is solo, .app__main is hidden outright
       (whatever a page put in there — no page has to remember to collapse its own content), and this
       sibling rail becomes the visible 72px strip instead, mirroring the chat's own minimal rail. */
    /* the Newton panel's width drives the left column — whoever sets it (page code, the rail, collapse) */
    const nw = $('#nw-chat');
    if (nw) {
      new MutationObserver(() => sideAuto(BIG.includes(nw.dataset.nw))).observe(nw, { attributes: true, attributeFilter: ['data-nw'] });
      sideAuto(BIG.includes(nw.dataset.nw || ''));   // the page may have set the width before this ran (a reload mid-event)
    }
    const body = $('.app__body'), main = body && $('.app__main', body);
    if (main && !$('.app-rail', body)) main.insertAdjacentHTML('afterend', `<div class="app-rail" aria-hidden="true"><svg><use href="#i-home"/></svg></div>`);
    /* the left window: everything in the body that isn't Newton goes into one card, so no page has to wrap it by hand */
    if (body && !$('.app__pane', body)) {
      const pane = document.createElement('div');
      pane.className = 'app__pane';
      [...body.children].filter((el) => !el.classList.contains('app__chat')).forEach((el) => pane.appendChild(el));
      body.prepend(pane);
    }
  });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); document.dispatchEvent(new CustomEvent('ag:change')); } });

  return {
    $, $$, get state() { return state; }, save, reset,
    VERIFY_TOTAL, CONNECT_TOTAL, homeState, verified, canPublish, publishBlocker,
    TYPE_ICON: { Launch: 't-launch', Fix: 't-fix', Sales: 't-sales', Players: 't-players', Event: 't-event' },   // a card's kind, a plain filled glyph like the bolt (Daria, 28.09)
    meltIn, icon, nwIcon, nwLabel, items, hasImage, byNewton, hubPreview, soon, confetti, setKeepingPreviews, STYLE_TAGS, style,
    btnIcon, morph, mountHeader, closeMenus, NAVS, navLabel, navOff, showHub, closeHub, VSTEPS, mountSidebar, mountChat, toast, magic: (el, o) => meltIn(el, o), magicDots: magic, enter, pageIn, swap, go, sideToggle, openVerify, openConnect, openItem, open, close
  };
})();
