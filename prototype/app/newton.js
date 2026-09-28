/* Newton in the product: a conversation per page, and unfinished work pinned wherever you are.
 *
 * chat.js is the engine (how a conversation looks and works); this file is the script of the
 * product — what Newton says where. Rules from Daria (26.09, handoff 6.10):
 *   1. Everything Newton suggests lives in the chat. Pages show content; signals are his messages.
 *      The only place to ask Newton is this panel — no ask lines on pages.
 *   2. Every page has its own conversation (Daria, 26.09 — replaces one conversation across all pages:
 *      other pages' messages were noise). When Newton himself moves you to another page in the middle of
 *      a task (the event, a draft landing in its section), the conversation comes along and stays until
 *      you go somewhere yourself. Unfinished work in another page's conversation is pinned at the top —
 *      Continue takes you back to it. Newton's messages about a page (signals) are pushed fresh each time
 *      you open it; a signal you've acted on doesn't come back.
 *   3. An event is built in the chat, one piece at a time. After each pick Newton switches the
 *      page on the left to the section (or mode) where the piece lives, and it shows up there.
 *   4. Short: one line and a clear action, from what the person needs on this page.
 *
 *   AG.newton.mount({ page: 'dashboard' | 'hub', route: () => 'home', kind: () => 'list' | 'empty' | 'home', onPage: (act) => {} })
 *   AG.newton.fresh('bundle') // true for a few seconds after Newton added it — the page highlights it
 *   AG.newton.cards(route)    // the action cards for a page (what to do); AG.newton.task(id) starts one in the chat
 *
 * Page vs chat (Daria, 26.09): the page says WHAT to do — a card with one call to action.
 * The chat does the HOW — ready options, one or two clicks, the result lands in its section.
 * A finished task takes its card off the page.
 */
AG.newton = (() => {
  const { $, toast } = AG;
  const KEY = 'aghanim-proto-chat';
  let mem = null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || mem; } catch (e) { return mem; } };
  const keep = (v) => { mem = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

  const ev = () => AG.state.event;
  const inReview = () => AG.state.verify.status === 'review';
  const STORE_ITEMS = 18;   // the store has 18 items (Items shows the first ones, Home says "18 store items")
  const setEv = (patch) => AG.save({ event: Object.assign({}, ev() || {}, patch) });
  const building = () => { const e = ev(); return !!(e && !e.built); };
  const flash = (key) => ({ flash: { key, at: Date.now() } });
  const noImg = () => AG.items.filter((it) => !AG.hasImage(it)).length;
  const unlinked = () => AG.items.filter((it) => !it.sku).length;

  /* Pictures in the choices are drawn in the hub's own look (Daria, 27.09): the same art, ground, type, cards and
     buttons as Hub (AG.skin), in the season's colours for the event. A message keeps only what to draw (art: { k, d }),
     the picture is drawn when shown — change the style in Hub and the cards in the chat follow. */
  const SK = () => AG.skin.current(), HW = () => AG.skin.seasonal(SK());
  const contentIcon = (text) => AG.skin.iconFor('', text);
  const ART = {
    idea: (o) => { const sk = HW(); sk.c = Object.assign({}, sk.c, { accent: o.mood[2] });
      return `<span class="ga" style="background:${AG.skin.bgCss(sk, true)};color:${sk.c.fg}">${AG.skin.artSvg(o.icon || 'castle', sk, 'ga__icon ga__icon--lg')}<span class="ga__title" style="${AG.skin.fontCss(sk)}">${o.title}</span></span>`; },
    /* a bundle is the hub's own item card: the picture on the hub's ground, the name, the price button */
    bundle: (b) => { const sk = b.season ? HW() : SK(), c = sk.c, rad = sk.w.rad != null ? Math.min(sk.w.rad, 14) : 10;
      return `<span class="ga ga--card" style="${AG.skin.surf(sk, rad)};${sk.surf === 1 || sk.surf === 2 ? `background:${c.surface};` : ''}color:${c.fg}">
        <span class="ga__pic" style="background:${AG.skin.bgCss(sk, true)}">${AG.skin.artSvg(AG.skin.iconFor(b.title, b.contents), sk)}</span>
        <span class="ga__name" style="${AG.skin.fontCss(sk)}">${b.title}</span>${AG.skin.hbtn(sk, b.price, rad)}</span>`; },
    days: (r) => { const sk = HW();
      return `<span class="ga" style="background:${AG.skin.bgCss(sk, true)};color:${sk.c.fg}">${r.title ? `<span class="ga__title" style="max-width:none;${AG.skin.fontCss(sk)}">${r.title}</span>` : ''}<span class="ga__days">${r.days.map((d, i) => `<i class="${d === '—' ? 'is-none' : ''}" style="${AG.skin.surf(sk, 3)}${i === 6 ? `;box-shadow:inset 0 0 0 1.5px ${sk.c.primary}` : ''}">${d === '—' ? '' : AG.skin.artSvg(contentIcon(d), sk)}</i>`).join('')}</span></span>`; },
    banner: ({ h, b }) => { const sk = HW();
      return `<span class="ga" style="background:${AG.skin.bgCss(sk, true)};color:${sk.c.fg}">${AG.skin.artSvg(sk.w.hero[0], sk, 'ga__icon ga__icon--lg')}<span class="ga__kick" style="color:${sk.c.primary}">Halloween · Oct 25–31</span><span class="ga__title" style="${AG.skin.fontCss(sk)}">${h.title}</span>${AG.skin.hbtn(sk, b.price, 8)}</span>`; }
  };
  AG.chat.art = (a) => (ART[a.k] ? ART[a.k](a.d) : '');
  /* "decide" sits under the block and finishes the whole event; labels apply to conversations saved before too */
  /* the event's five steps, counted from the idea (Daria, 27.09). Buttons, UX-edited: a verb and the thing, what the click
     does — the idea starts the build, every piece is added (the same "Add …" as the tasks on the page cards) */
  const EVENT_STEPS = ['idea', 'bundle', 'rewards', 'banner', 'push'];
  AG.chat.aiCta = () => false;   // "Build this event" goes on step by step — a goal button, not Newton's (Daria, 28.09); the hook stays for other flows
  const STEP_CTA = { idea: 'Build this event', bundle: 'Add bundle', rewards: 'Add gifts', banner: 'Add banner', push: 'Add push' };
  /* a task from a card on a page ends with the same words as the card's button — "Add bundle", "Link it", "Upgrade day 7"
     (Daria, 27.09: not "Add to Bundles" — you add to the hub, not to a section); saved conversations follow too */
  AG.chat.stepCta = (d) => STEP_CTA[d.flow] || (d.card && cardDef(d.card) && cardDef(d.card).cta)
    || (d.flow === 'start' && STARTS[d.route] && STARTS[d.route].cta) || null;
  AG.chat.stepLabel = (d) => (EVENT_STEPS.includes(d.flow) ? `${EVENT_STEPS.indexOf(d.flow) + 1} of 5` : null);
  AG.chat.decideLabel = (d) => (EVENT_STEPS.includes(d.flow) ? 'Decide the whole event for me' : null);   // not the same words as the summary's button (UX answers 28.09)
  const artIdea = (o) => ({ k: 'idea', d: { title: o.title, mood: o.mood, icon: o.icon } });
  const artBundle = (b) => ({ k: 'bundle', d: { title: b.title, price: b.price, contents: b.contents || b.sub, season: b.season } });
  const artDays = (r) => ({ k: 'days', d: { days: r.days, title: r.title } });
  const artBanner = (h, b) => ({ k: 'banner', d: { h: { title: h.title }, b: { price: b.price } } });
  const withArt = (list, f) => list.map((o) => Object.assign({}, o, { art: f(o) }));
  /* conversations saved before the cards were drawn from the hub's look keep an old picture: find the option by its
     title (an idea, a bundle, the 7 days, a banner) and draw it again */
  AG.chat.legacyArt = (o) => {
    if (!o) return null;
    const name = String(o.title || '').split(' · ')[0], price = (String(o.title || '') + ' ' + String(o.sub || '')).match(/\$\d+(\.\d+)?/);
    const b = BUNDLES.find((x) => x.title === name); if (b) return artBundle(Object.assign({ season: true }, b));
    if (price && /bundle|kit|bag|chest|stash|pack|hoard/i.test(name)) return artBundle({ title: name, price: price[0], contents: o.sub });
    if (price) return artBanner({ title: o.title }, { price: price[0] });   // a banner headline (it may share an idea's title): its price is in the line under it
    const idea = IDEAS.find((x) => x.title === o.title); if (idea) return artIdea(idea);
    const r = REWARDS.find((x) => x.title === o.title); if (r) return artDays(r);
    return null;
  };

  /* ================= the event: Halloween (handoff 3, 6.10) =================
     Four pieces: bundle, login gifts, banner on the hub Home, push. Newton never states what happens
     inside the game (6.6): everything here is something the hub itself runs. */
  const DATES = 'Oct 25 – 31';
  const IDEAS = [
    { mood: ['#2B1A3D', '#0F0A1E', '#C9B8FF'], icon: 'castle', title: 'Night of the Pixel Moon', sub: 'Dark look, a big bundle, a gift every day' },
    { mood: ['#4A1F0E', '#1B1531', '#FF8A3D'], icon: 'present', title: 'Pumpkin Rush', sub: 'A cheap bundle for first-time buyers' },
    { mood: ['#1B1531', '#0B0716', '#F2B33D'], icon: 'locked-chest', title: 'Haunted Vault', sub: 'A premium bundle for your top spenders' },
    { mood: ['#20131F', '#3D2308', '#B3A6FF'], icon: 'potion-ball', title: 'Seven Spooky Nights', sub: 'A gift every night, the best one on Halloween' },
    { mood: ['#10202A', '#141A2E', '#4FD1A5'], icon: 'power-lightning', title: 'Raiders After Dark', sub: 'Energy deals for players who come back at night' },
    { mood: ['#33202F', '#4A1F0E', '#F26B5B'], icon: 'heart-bottle', title: 'Candy Raid', sub: 'Small treats every day, a big one on Halloween' }
  ];
  const BUNDLES = [
    { title: 'Pumpkin Chest', sub: '1,200 gems + 3 hero shards · $9.99', price: '$9.99', contents: '1,200 gems · 3 hero shards' },
    { title: 'Moonlit Stash', sub: '800 gems + 200 energy · $6.99', price: '$6.99', contents: '800 gems · 200 energy' },
    { title: 'Night Raider Kit', sub: '500 gems + XP Booster · $4.99', price: '$4.99', contents: '500 gems · XP Booster' },
    { title: 'Witching Hoard', sub: '2,000 gems + Legendary Shard · $19.99', price: '$19.99', contents: '2,000 gems · Legendary Shard' },
    { title: 'Candy Bag', sub: '300 gems + 100 energy · $2.99', price: '$2.99', contents: '300 gems · 100 energy' },
    { title: 'Ghost Hunter Pack', sub: '1,500 gems + 2 hero shards · $12.99', price: '$12.99', contents: '1,500 gems · 2 hero shards' }
  ];
  const REWARDS = [
    { title: 'Gems every day, a chest on day 7', sub: '50 → 300 gems, Gold Chest on Halloween', days: ['50 gems', '75 gems', '100 gems', '150 gems', '200 gems', '300 gems', 'Gold Chest'] },
    { title: 'Energy first, gems later', sub: '100 energy for 3 days, then gems', days: ['100 energy', '100 energy', '100 energy', '150 gems', '200 gems', '250 gems', '400 gems'] },
    { title: 'Three big days', sub: 'Gifts on days 1, 4 and 7 only', days: ['200 gems', '—', '—', '1 hero shard', '—', '—', 'Gold Chest'] }
  ];
  const HEADLINES = (idea, b) => [
    { title: idea.title, sub: `${b.title}: ${b.contents || b.sub || ''}` },
    { title: 'The moon is up. So are the prizes.', sub: `${b.title} and a gift every day` },
    { title: '7 nights. 7 gifts.', sub: 'Log in every day for a gift' },
    { title: 'Halloween is on the hub', sub: `${b.title} and daily gifts` },
    { title: 'Trick, treat, raid.', sub: `${b.title}: ${b.contents || b.sub || ''}` },
    { title: 'One week only.', sub: `${b.title} and daily gifts` }
  ];

  /* ================= the hub builder (handoff 5.4) =================
     Nothing to set up and nothing to step through: the hub is already built and ready to publish.
     Newton's quick actions are icons in the bar under the canvas (Hub.html, Daria 26.09) — not in the chat.
     Here: what you type about the look (the page says what it understands: look().keys, and does it: onLook)
     and Newton's messages about the hub. */
  /* the settings of the hub page you're on come as his message with a widget (Daria, 26.09): which categories the
     store shows, the Player ID hint on Login, which leaderboards — the page itself says what (opts.settings) */
  const hubHere = () => (opts.settings ? [opts.settings()] : []);
  /* problems in the hub (items not linked, no images) are alerts, not messages: docked above the input on every hub
     page until fixed (Daria, 26.09 — a problem is an alert, a suggestion is a question in the conversation) */
  const HUB_ALERTS = () => [
    /* the same card as on the Items page (Daria, 28.09: they're about one thing) */
    unlinked() ? { lv: 1, type: 'Fix', title: 'Purchases can’t be delivered', sub: 'They aren’t linked to your game.', sig: { v: `${unlinked()}/${STORE_ITEMS}`, u: 'items', bar: Math.round(unlinked() / STORE_ITEMS * 100) }, action: { label: 'Link', act: 'link-all' } } : null,
    noImg() ? { lv: 2, type: 'Fix', title: `${noImg()} items have no image`, action: { label: 'Generate', act: 'gen-images' } } : null,
    /* the other problems of the game show here too (Daria, 28.09): Home's broken and tolerable cards, each opening its own task */
    /* only what needs a reaction now (Daria, 28.09: not everything): the broken ones — tolerable and advice stay on Home */
    ...cards('home').filter((c) => c.lv === 1 && c.id !== 'item-links')
      .map((c) => ({ lv: c.lv, type: c.type, title: c.title, sub: c.sub, sig: c.sig, action: { label: c.cta, act: 'task:' + c.id } }))].filter(Boolean);
  const syncAlerts = () => { if (chat) chat.setAlerts(page === 'hub' ? HUB_ALERTS() : []); };

  /* Empty sections: nothing to generate from — 2–3 ready starts, each a card; its task makes the draft */
  const STARTS = {
    'store-promotions': { cta: 'Add promotion', tone: 'sky', icon: 'store', kicker: 'Promotion', where: 'Store → Promotions', cols: ['Promotion', 'Runs'], list: [
      { action: 'Run a launch week bonus', title: 'Launch week bonus', sub: '+20% gems on every gem pack', col: '7 days after you publish', why: 'More first purchases' },
      { action: 'Run a weekend energy sale', title: 'Weekend energy sale', sub: '−30% on Energy Refill', col: 'Every Sat and Sun', why: 'Busier weekends' },
      { action: 'Double the first purchase', title: 'Double first purchase', sub: 'Twice the gems on the first purchase', col: 'No end date', why: 'Easier first purchase' }] },
    'store-subscriptions': { cta: 'Add plan', tone: 'sky', icon: 'store', kicker: 'Subscription', where: 'Store → Subscriptions', cols: ['Plan', 'Price'], list: [
      { action: 'Launch Raider Pass', title: 'Raider Pass', sub: '100 gems every day for 30 days', col: '$4.99 / month', why: 'Steady monthly revenue' },
      { action: 'Launch a VIP plan', title: 'VIP', sub: '+10% gems on every purchase, a Gold Chest a month', col: '$9.99 / month', why: 'For your top spenders' }] },
    'store-loot-boxes': { cta: 'Add box', tone: 'sky', icon: 'store', kicker: 'Loot box', where: 'Store → Loot boxes', cols: ['Box', 'Price'], list: [
      { action: 'Add a Hero Chest', title: 'Hero Chest', sub: '3 random hero shards, 5% chance of a legendary', col: '$4.99', why: 'Odds filled in for you' },
      { action: 'Add a Mystery Gem Box', title: 'Mystery Gem Box', sub: '100 to 1,000 gems', col: '$2.99', why: 'A cheap first try' }] },
    'marketing-campaigns': { cta: 'Add campaign', tone: 'pink', icon: 'mega', kicker: 'Campaign', where: 'Marketing → Campaigns', cols: ['Campaign', 'When'], list: [
      { action: 'Send a welcome gift', title: 'Welcome gift', sub: 'Pop-up · 100 gems', col: 'First login on the hub', why: 'Players see the store sooner', line: 'A pop-up with 100 gems on first login.' },
      { action: 'Announce your hub launch', title: 'Hub launch announcement', sub: 'Push and email', col: 'The day the hub goes live', why: 'Your first visitors', line: 'A push and an email on launch day.' },
      { action: 'Remind players about their cart', title: 'Cart reminder', sub: 'Email', col: 'Item left in the cart for 24 h', why: 'Saves lost purchases', line: 'An email when a cart sits for a day.' }] },
    'marketing-creators': { cta: 'Set up', tone: 'pink', icon: 'mega', kicker: 'Creators', where: 'Marketing → Creators', cols: ['Program', 'How it works'], list: [
      { action: 'Start creator codes', title: 'Creator codes', sub: 'A personal code for each creator', col: '+10% gems for players, a revenue share for the creator', why: 'New players who trust them' },
      { action: 'Invite your first creator', title: 'Invite your first creator', sub: 'The invite and a personal code', col: 'Ready to send', why: 'Ready to send today' }] },
    'marketing-codes': { cta: 'Create code', tone: 'pink', icon: 'mega', kicker: 'Code', where: 'Marketing → Codes', cols: ['Code', 'Gives'], list: [
      { action: 'Create a code for your Discord', title: 'DISCORD100', sub: '100 gems for your Discord', col: '100 gems', why: 'Brings your community in' },
      { action: 'Create a launch code', title: 'LAUNCH', sub: 'A free Energy Refill for the first 1,000', col: 'Free Energy Refill', why: 'A reason to visit on day one' }] },
    'engagement-daily-quiz': { cta: 'Start quiz', tone: 'lime', icon: 'heart', kicker: 'Daily quiz', where: 'Engagement → Daily quiz', cols: ['Quiz', 'Reward'], list: [
      { action: 'Start a quiz from your store page', title: 'Quiz from your App Store page', sub: '5 questions, 20 gems per right answer', col: '20 gems per right answer', why: 'A reason to visit daily' },
      { action: 'Start a quiz from your patch notes', title: 'Quiz from your patch notes', sub: 'A question about each update', col: '20 gems per right answer', why: 'Players read your updates' }] },
    'players-segments': { cta: 'Add segment', tone: 'violet', icon: 'users', kicker: 'Segment', where: 'Players → Segments', cols: ['Segment', 'Who'], list: [
      { action: 'Create a Payers segment', title: 'Payers', sub: 'Bought anything on the hub', col: 'Updates live', why: 'Offers for your best players' },
      { action: 'Create a Non-payers segment', title: 'Non-payers', sub: 'Logged in, haven’t bought yet', col: 'Updates live', why: 'Target the first purchase' },
      { action: 'Create an Inactive segment', title: 'Inactive for 14 days', sub: 'No visits for two weeks', col: 'Updates live', why: 'Win them back' }] }
  };
  const WHERE = Object.assign({ store: 'Store → Items', 'store-bundles': 'Store → Bundles', 'store-offers': 'Store → Offers' }, ...Object.keys(STARTS).map((k) => ({ [k]: STARTS[k].where })));

  /* Pages that wait for players: each launch step left is a card, plus something that earns while you wait */
  const WAIT = {
    'analytics-reports': ['verify', 'webhooks', 'publish', 'find'],
    'analytics-transactions': ['verify', 'webhooks', 'publish'],
    'players-profiles': ['publish', 'find'],
    'players-attributes': ['webhooks']
  };

  function here() {
    if (page === 'hub') return hubHere();
    return [];                                        // Dashboard: the page has action cards; Newton's own word comes typed (greet)
  }

  /* ================= Newton greets you on every page (Daria, 27.09) =================
     The chat is never empty. You open a page — he types: what he noticed here (in his words, not the card's), why it
     matters, and offers to do it himself — one button, and it's done (he takes the recommended option). Two things at
     most, the most urgent first (the page's cards, in their order). Pages with nothing to fix still get a word. */
  const NOTE = {
    halloween: ['Halloween is the biggest week of the season for games like yours. I can build the whole event — bundle, gifts, banner and push — in under a minute.', 'Build the event'],
    'welcome-gift': ['New players land on the hub and nothing greets them. A small gift on the first login sends them straight to the store.', 'Add the welcome gift'],
    'login-gap': ['Most visitors drop off at login: they’re asked for a Player ID they can’t find. Login from the game removes that step — it’s one command for your developer.', 'Send it to my developer'],
    'first-gift': ['The first-login gift is ready but switched off, so new players get nothing yet.', 'Turn the gift on'],
    'summer-sale': ['Summer Sale brings a fifth of this week’s money, and it stops tomorrow. I’d keep it running another week.', 'Extend the sale'],
    winback: ['38 of your regular buyers haven’t been back for two weeks. I’ve drafted an email with an offer for them.', 'Add the email'],
    'item-links': ['A few items can’t reach players yet. I’ve matched each one to an item in your game by name and price.', 'Link the items'],
    'starter-bundle': ['New players rarely spend much on the first purchase. A bundle under $5 is an easy first step.', 'Make a $5 bundle'],
    'gold-chest': ['Gold Chest isn’t linked to your game, so two bundles and the day 7 gift can’t be delivered. It matches chest_gold.', 'Link Gold Chest'],
    day7: ['Day 7 is when players come back for the big gift, and right now it can’t be delivered. I’d give a Legendary Shard instead.', 'Swap the day 7 gift'],
    'l-verify': ['Payments wait for company verification. It’s the slowest step, so it’s worth starting now — I’ve filled in what I could.', 'Verify for me'],
    'l-connect': ['Purchases can’t reach players until the game is connected. It’s one command for whoever codes your game.', 'Send it to my developer'],
    'l-publish': ['Nothing blocks your hub anymore. It can go live now.', 'Publish it'],
    'l-find': ['Players can’t get to the hub from the game yet: a login button and a link inside the game fix that.', 'Send it to my developer'],
    'start:marketing-campaigns:0': ['Nothing greets new players yet. A welcome gift on the first login is ready to go.', 'Add the welcome gift'],
    'start:marketing-campaigns:1': ['Your launch is a reason to write to players. A push and an email are ready.', 'Add the launch push'],
    'start:marketing-campaigns:2': ['Players leave things in the cart. An email a day later brings some of them back.', 'Add the cart email']
  };
  /* a page where nothing needs fixing still gets a word, never an empty chat */
  const QUIET = {
    'analytics-transactions': () => (AG.homeState() === 3
      ? { text: 'Three payments failed on Wednesday, all on the same card provider. Your hub is fine — I’m keeping an eye on that provider.', actions: [{ label: 'Show me Wednesday', q: 'Why did revenue drop on Wednesday?' }] }
      : { text: 'No purchases yet. They’ll show up here as soon as the hub is live and connected — I’ll tell you about the first one.' }),
    home: () => ({ text: 'Everything on Home is taken care of. I’ll bring up anything new as soon as I notice it.' })
  };
  const quietDefault = () => ({ text: `All good in ${AG.navLabel('dashboard', opts.route()) || 'this section'}. Ask me anything about it — or I’ll let you know when something needs you.` });
  /* Home, every visit (Daria, 27.09): what happened → what Newton did himself (a list, each with Undo) → what he'd have
     you do next, each with a button to let him do it. Unfinished tasks are named there too, with a way back into them. */
  const NEXT = { 'l-verify': 'Start verification: it’s the slowest step, and I’ve filled in what I could.', 'l-connect': 'Connect the game: it’s one command for your developer.',
    'l-find': 'Add login and a hub link inside the game: a small job for your developer.' };
  function summary(ids) {
    const st = AG.homeState(), v = AG.state.verify, c = AG.state.connect;
    /* in lists, the numbers in bold, the change with its arrow (Daria, 27.09: easier to read) */
    const now = st === 3 ? ['Revenue this week: **$12,480** ↑18%', '**1,204** players paid'].concat(cardDef('summer-sale') && !isDone('summer-sale') ? ['Summer Sale ends **tomorrow**'] : [])
      : st === 2 ? ['Your hub went live **today**', '**312** players came in the last 24 hours', 'No purchases yet — **59%** stop at login']
      : ['Built from your App Store page: **7** pages, **18** items, **6** offers, **3** bundles, **4** news posts', 'Not live yet — only you see it'];
    const e = ev();
    if (e && e.scheduled) now.push('Halloween event is scheduled for **Oct 25**');   // verification doesn't gate the event in the prototype (Daria, 28.09)
    else if (e && e.built) now.push('Halloween event is built — **one click** to schedule it');
    if (v.status === 'review') now.push('Verification is **in review**');   // waiting, not a thing to do (Daria, 28.09)
    /* no "Still to do" list (UX answers 28.09): the page's cards say it; the chat gives what happened, what Newton did,
       and the button to hand it over. Split in two lines, two buttons, one message (Daria, 28.09: one "Decide everything
       for me" was quietly doing only 2 of the 4 cards on screen, and lumped launch in with sales — different in kind):
       Launch — what stands between the hub and going live — and everything else (Fix/Sales/Players/Event) are two lines. Two messages here would work too, but the CSS that greys out a stale "Decide"
       once a newer Newton message follows (chat.css) would grey out the first of the two the instant the second lands —
       one message sidesteps that. Each line covers every matching card actually on the page, not a fixed count. */
    const li = (a) => a.map((x) => `- ${x}`).join('\n');
    const happened = { sid: `hi:home:${st}:a:${Date.now()}`, summary: true,
      text: `**What happened**\n${li(now)}`,
      widget: { type: 'log', flow: 'log', key: st, title: 'What I did', rows: didRows(st) } };
    const goAct = (label, list) => ({ label, act: list.length > 1 ? `do-all:${list.join(',')}` : `do:${list[0]}`, kind: 'ai' });
    const launchIds = ids.filter((id) => typeOf(id) === 'Launch'), otherIds = ids.filter((id) => typeOf(id) !== 'Launch');
    /* say what, not how many (Daria, 29.09: "Get me live" read shallow — about what?): each line names the things themselves.
       "Decide everything for me" means everything — launch included; with both kinds on the table, a second, narrower
       button takes only the launch steps */
    const words = (list) => { const a = list.map((id) => askOf(id).replace(/\bmy\b/g, 'your')); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; };
    const lines = [], actions = [];
    if (launchIds.length) lines.push(`**To go live:** ${words(launchIds)}.`);
    if (otherIds.length) lines.push(`**To bring in more players and sales:** ${words(otherIds)}.`);
    if (launchIds.length && otherIds.length) actions.push(goAct('Do the launch steps for me', launchIds));
    if (ids.length) actions.push(goAct('Decide everything for me', [...launchIds, ...otherIds]));
    const next = actions.length ? { sid: `hi:home:${st}:b:${Date.now()}`, summary: true, text: lines.join('\n\n'), actions } : null;
    return [happened, next].filter(Boolean);   // nothing to suggest: no empty heading
  }
  function greeting() {
    const r = opts.route();
    let ids = (r === 'analytics-transactions' && AG.homeState() === 3 ? [] : cards(r).map((c) => c.id)).filter((id) => NOTE[id] && !(id === 'l-verify' && inReview()));   // Transactions with purchases shows no cards
    const going = new Set(allOpen().map((t) => t.taskId));   // under way already (the event you've started): not offered again
    ids = ids.filter((id) => !going.has(ALIAS[id] || id));   // no cap (Daria, 28.09): every card on the page gets covered, not just the first two
    /* the summary is one for the whole game, on every Dashboard page (Daria, 28.09: the chat doesn't repeat the page's cards —
       it gives the digest and "Decide everything for me"); what to do next — this page's first, then Home's */
    if (page === 'dashboard') {
      const home = r === 'home' ? [] : cards('home').map((c) => c.id).filter((id) => NOTE[id] && !(id === 'l-verify' && inReview()) && !going.has(ALIAS[id] || id));
      return summary([...new Set([...ids, ...home])]);
    }
    if (!ids.length) return Object.assign({ sid: `hi:${r}:quiet:${AG.homeState()}` }, (QUIET[r] || quietDefault)());
    return { sid: `hi:${r}:${ids.join(',')}`, text: ids.map((id) => NOTE[id][0]).join('\n\n'),
      actions: forMe(ids) };
  }
  /* "… for me" (Daria, 27.09): one button, "Decide everything for me" — the words the event already uses; no question before it.
     Several things — Newton does them one after another. Each one on its own stays on the page, on its card. */
  const forMe = (ids) => (ids.length ? [{ label: 'Decide everything for me', act: ids.length > 1 ? `do-all:${ids.join(',')}` : `do:${ids[0]}`, kind: 'ai' }] : []);
  /* one after another: the next starts once Newton has nothing open in the chat (a working block, a step, a form) */
  /* one calm pace for everything Newton does by himself (Daria, 28.09: "it all twitched and was done" — you must see the
     work happen): the choice he'll make stays on screen a moment before he makes it, the working lines tick at a readable
     speed, the next job starts after a pause, and the next step of a flow comes after the page has settled */
  /* Timing, by the usual UX limits (Daria, 28.09: too quick, then too slow): ~1 s keeps the flow unbroken, ~10 s is where
     attention goes — so a visible step takes about a second, a whole "Decide everything" stays within ~5–8 s. Inside a plan
     the jobs' own steps are out of sight (muffled), so they run quick: the plan's line is what you watch. */
  const PACE = { look: 1200, tick: 900, after: 600, next: 400, step: 1000, evStep: 1100, evEnd: 800, planMin: 1200, planSettle: 300 };
  const QUICK = { look: 200, tick: 250, after: 200, step: 300, evStep: 250, evEnd: 200 };
  const pace = (k) => (chat && chat.opts.muffle && QUICK[k] != null ? QUICK[k] : PACE[k]);
  /* "Decide everything for me" is one piece of work, not a burst of messages (Daria, 28.09): your ask names what you hand over,
     Newton answers with one plan block — the jobs one after another, each line ticking with what came of it — and then one
     short word with the ways to see it. Each job's own messages are kept but muffled (out of sight); the event's card is
     shown at the end, it's the result. */
  const askOf = (id) => { const c = cardDef(id) || {}, a = c.ask || c.title || id; return a.charAt(0).toLowerCase() + a.slice(1); };
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const snap = () => ({ v: AG.state.verify.status, c: AG.state.connect, pub: AG.state.published, ev: !!(ev() && ev().built),
    drafts: Object.fromEntries(Object.entries(AG.state.drafts || {}).map(([k, l]) => [k, l.length])) });
  function resultOf(b) {
    const d = AG.state.drafts || {}, r = Object.keys(d).find((k) => (d[k] || []).length > (b.drafts[k] || 0));
    if (r) { const x = d[r][d[r].length - 1]; return { text: `${x.title} — a draft in ${SECTION(r)}`, act: { label: `Open in ${SECTION(r)}`, act: `go:${r}`, kind: 'tertiary', at: r } }; }
    if (AG.state.verify.status !== b.v) return { text: 'sent for review' };
    if (AG.state.connect > b.c) return { text: 'purchases reach players' };
    if (AG.state.published && !b.pub) return { text: 'your hub is live' };
    if (ev() && ev().built && !b.ev) return { text: 'built — one click to schedule' };
    return { text: 'done' };
  }
  /* the plan in progress: you starting something yourself in the middle stops it (QA 28.09 — a card clicked mid-plan was
     muffled out of sight and the plan waited for it forever). What's done keeps its result; the rest is left for you. */
  let planning = null;
  function stopPlan() {
    const p = planning; if (!p || p.stopped) return;
    p.stopped = true; planning = null; chat.opts.muffle = false;
    chat.messages.forEach((m) => { if (!p.before.has(m.id) && m.id !== p.plan.id && m.archived && !(m.widget && m.widget.type === 'working')) chat.update(m.id, { archived: false }); });   // the job it was on shows as it is
    const steps = p.steps.map((s, k) => (k < p.i ? s : k === p.i ? `${s} — stopped, you took over` : `${s} — left for you`));
    chat.widget(p.plan.id, { kicker: 'Stopped — you started something else', steps, at: p.i, stopped: true });
  }
  function doAll(ids, label) {
    ids = ids.filter(Boolean);
    const names = ids.map(askOf), steps = names.map(capital), acts = [];
    chat.push({ from: 'you', text: `${label || 'Decide everything for me'}: ${names.join(', ')}` });   // echoes the button actually pressed — "Get me live" reads differently from "Decide everything for me" (Daria, 28.09)
    chat.say({ tools: false, widget: { type: 'working', ai: true, kicker: 'Deciding for you', title: ids.length > 1 ? `${ids.length} things, one after another` : steps[0], steps: steps.slice(), at: 0, pct: 0 } }, 600).then((plan) => {
      const busy = () => chat.messages.some((m) => m.id !== plan.id && m.widget && !m.widget.done && ['working', 'options', 'fields'].includes(m.widget.type));
      const mine = new Set();
      const me = planning = { plan, steps, i: 0, before: new Set(chat.messages.map((m) => m.id)), stopped: false, inner: false, queue: [] };
      const run = (i) => {
        if (me.stopped) return;
        me.i = i;
        if (i >= ids.length) { planning = null; finishAll(plan, steps, acts, mine); if (me.queue.length) setTimeout(() => me.queue.forEach((q) => task(q)), 1800); return; }   // then what you asked for meanwhile
        const b = snap(), before = new Set(chat.messages.map((m) => m.id)), t0 = Date.now();
        chat.opts.muffle = true;
        me.inner = true; doForMe(ids[i]); me.inner = false;   // the plan's own job, not you taking over
        const settle = () => {
          if (me.stopped) return;
          if (Date.now() - t0 < 60000 && (busy() || Date.now() - t0 < PACE.planMin)) return setTimeout(settle, 200);
          setTimeout(() => {   // what a job says after its last step (a result line, the event's card) lands muffled too
            if (me.stopped) return;
            if (busy() && Date.now() - t0 < 60000) return setTimeout(settle, 200);   // muffle stays on until the whole plan is done (a job's last word may still be on its way); stopPlan lifts it if you take over
            chat.messages.forEach((m) => { if (!before.has(m.id)) mine.add(m.id); });
            const res = resultOf(b); if (res.act && !acts.some((a) => a.act === res.act.act)) acts.push(res.act);
            steps[i] = `${steps[i]} — ${res.text}`;
            chat.widget(plan.id, { steps: steps.slice(), at: i + 1, pct: Math.round(((i + 1) / ids.length) * 100) });
            setTimeout(() => run(i + 1), PACE.next);
          }, PACE.planSettle);
        };
        setTimeout(settle, 300);
      };
      run(0);
    });
  }
  function finishAll(plan, steps, acts, mine) {
    chat.widget(plan.id, { kicker: 'Done for you', title: steps.length > 1 ? `${steps.length} things done` : plan.widget.title });
    const card = chat.messages.find((m) => mine.has(m.id) && m.widget && m.widget.type === 'pack');   // the event: its card is the result
    if (card) { chat.update(card.id, { archived: false }); setTimeout(() => AG.magic(document.querySelector(`#nw-chat [data-mid="${card.id}"] .cw`)), 60); }
    const drafts = acts.length ? ' The drafts stay drafts until your hub goes live.' : '';
    setTimeout(() => {   // the last job's late words land muffled first, then the plan speaks
      chat.messages.forEach((m) => { if (m.archived && m.from === 'newton' && !mine.has(m.id)) mine.add(m.id); });
      chat.opts.muffle = false;
      chat.newton({ tools: false, text: `Done — ${steps.length === 2 ? 'both handled' : steps.length > 2 ? `all ${steps.length} handled` : 'handled'}.${drafts}`, actions: acts });
      syncSummary();   // the summary above the plan no longer offers what the plan just did
    }, 900);
  }
  let greetT = 0;
  function greet(key) {
    clearTimeout(greetT);
    let g = greeting(); if (!g) return;
    if (!Array.isArray(g) && handled.has(g.sid)) g = Object.assign({ sid: `${g.sid}:q` }, (QUIET[opts.route()] || quietDefault)());   // you've answered that one: a quiet word, never an empty chat
    if (tasksIn(key, chat.messages).some((t) => t.open && t.id === actives()[key])) return;   // you're in the middle of a task here
    const list = Array.isArray(g) ? g : [g];
    const next = (k) => {
      chat.thinking();
      greetT = setTimeout(() => {
        chat.stopThinking();
        if (ctxKey() !== key || showing !== key) return;   // you've moved on meanwhile
        if (tasksIn(key, chat.messages).some((t) => t.open && t.id === actives()[key])) return;   // or started a task: no stale offer after it
        chat.push(Object.assign({ from: 'newton', tools: false, ctx: key, stream: true }, list[k]));
        if (k + 1 < list.length) greetT = setTimeout(() => next(k + 1), 1400);
      }, 900);
    };
    next(0);
  }
  /* the chat and the page never disagree (Daria, 29.09: "they must never lag behind each other or argue"): whatever got done —
     here, on a card, in another tab — Newton's summary on screen is rewritten in place to what's true now: done things
     leave its lines, "What happened" picks up the news; with nothing left to offer, the offer goes */
  function syncSummary() {
    if (!chat || page !== 'dashboard' || planning || showing !== ctxKey()) return;
    const live = chat.messages.filter((m) => m.summary && !m.archived && !m.stream);
    const a = live.filter((m) => /:a:/.test(m.sid)).pop(), b = live.filter((m) => /:b:/.test(m.sid)).pop();
    if (!a && !b) return;
    const g = greeting(); if (!Array.isArray(g)) return;
    const [happened, next] = [g[0], g[1] || null];
    if (a && happened && a.text !== happened.text) chat.update(a.id, { text: happened.text });
    if (!b) return;
    if (!next) { chat.remove(b.id); return; }
    const same = b.text === next.text && JSON.stringify(b.actions) === JSON.stringify(next.actions);
    if (!same) chat.update(b.id, { text: next.text, actions: next.actions });
  }
  /* "… for me": Newton opens the task and takes the recommended option himself */
  function doForMe(id) {
    const direct = { 'l-publish': 'publish' };
    if (id === 'l-verify') return verifyForMe();
    if (['l-connect', 'l-find', 'login-gap'].includes(id)) return connectForMe();
    if (direct[id]) return onAction(direct[id], { kind: 'msg', chat, msg: {} });
    task(id);
    if (ALIAS[id]) return;
    const t0 = Date.now();
    const tick = () => {
      const m = chat.messages.slice().reverse().find((x) => x.widget && !x.widget.done && (x.widget.card === id
        || (id === 'halloween' && x.widget.flow === 'idea') || (id.startsWith('start:') && x.widget.flow === 'start')));
      if (!m) { if (Date.now() - t0 < 5000) setTimeout(tick, 200); return; }
      /* let the options be seen — the recommended one is already picked — then take it */
      setTimeout(() => onAction(m.widget.flow === 'start' ? 'submit' : 'decide', { chat, msg: m, data: m.widget }), pace('look'));
    };
    setTimeout(tick, 400);
  }
  /* what Newton did on his own while you were away, each with Undo — publishers check every number (brief:
     "how the user controls what the machine did"; Daria, 27.09: on Home). Undone rows stay undone. */
  const LOG = [
    { short: 'Translated to Spanish', text: 'Translated 6 new items to Spanish', when: '2 h ago · with your glossary' },
    { short: 'Added a news post', text: 'Added “Patch 1.4” to News', when: 'yesterday · from your RSS' },
    { short: 'Rounded prices', text: 'Rounded prices of 4 items', when: 'yesterday · by your price template' }];
  const DID = {
    1: [{ short: 'Drew pictures', text: 'Drew pictures for all 18 items', when: 'while building · in your game’s style' },
      { short: 'Wrote news', text: 'Wrote 4 news posts from your App Store updates', when: 'while building · as drafts' },
      { short: 'Filled in company details', text: 'Filled in your company details', when: 'for verification · from your store page' }],
    2: [{ short: 'Prepared a first-login gift', text: 'Prepared a first-login gift: 100 coins', when: 'today · off until you turn it on' },
      { short: 'Checked where players drop off', text: 'Checked where players drop off', when: 'today · at login' }],
    3: LOG };
  /* you already added a welcome gift yourself (with Newton, in Campaigns): he doesn't also say he prepared one */
  const gifted = () => hasDraft('marketing-campaigns', 'Welcome gift');
  const didRows = (st) => DID[st].map((r, i) => Object.assign({ n: i }, r, AG.state.undone[`${st}:${i}`] ? { undone: true } : {}))   // n: the row's own number, for Undo
    .filter((r, i) => !(st === 2 && i === 0 && gifted()));

  /* ready questions above the input change with the page (handoff 6.2.4) */
  const SUGG = {
    1: ['What brings the first sale?', 'Why verify first?', 'Restyle my hub'],
    2: ['How do I bring players in?', 'Is my integration healthy?', 'What do similar games sell first?'],
    3: ['Why did revenue drop on Wednesday?', 'Draft a starter bundle under $5', 'Which items sell best?']
  };
  const PROMPTS = {
    'analytics-reports': ['What should I watch in the first week?', 'Which report shows why players don’t buy?'],
    'analytics-transactions': ['How do I test a purchase without real money?', 'When do payouts arrive?'],
    store: ['Build a starter bundle under $5', 'Are my prices in line with similar games?'],
    'store-bundles': ['Build a bundle for new players', 'Suggest a Halloween bundle'],
    'store-offers': ['Which offer should be on the hub Home?', 'Make an offer for players who haven’t bought'],
    'store-promotions': ['What discount works for gems?', 'Prepare a Halloween sale'],
    'store-currencies': ['Where is each currency used?', 'Are my gem prices consistent?'],
    'store-subscriptions': ['Is a subscription right for my game?', 'What price works for a monthly pass?'],
    'store-loot-boxes': ['What odds do similar games use?', 'Turn Gold Chest into a loot box'],
    'marketing-campaigns': ['Remind players about their cart', 'Plan a Halloween push'],
    'marketing-creators': ['How do creator codes work?', 'What revenue share is common?'],
    'marketing-codes': ['Make a code for my Discord', 'How many codes should I give out?'],
    'engagement-daily-rewards': ['Make day 7 more valuable', 'Switch to a 14-day cycle'],
    'engagement-loyalty': ['How fast do players reach Gold?', 'Add a level between Gold and Platinum'],
    'engagement-leaderboards': ['Add a weekly leaderboard', 'What rewards work for the top 10?'],
    'engagement-achievements': ['Add an achievement for a 30-day streak', 'Reward achievements with items'],
    'engagement-daily-quiz': ['How often should the quiz change?', 'What reward fits a quiz?'],
    'players-segments': ['Who will my best players be?', 'Which segments do similar games use?'],
    'players-profiles': ['How do players find their Player ID?', 'Why can’t a player log in?'],
    'players-attributes': ['Which attributes should my game send?', 'What does my developer need to do?']
  };
  /* every ready question stays on screen; the ones the prototype can't answer yet only show a tooltip
     (Daria, 26.09: block them, don't remove them) — the chat asks wired() which is which */
  const wired = (q) => { const t = q.toLowerCase(); return ANSWERS.some((a) => (a.match || []).some((k) => t.includes(k))); };
  /* Ready questions above the input are for a blank page (Daria, 26.09): an empty section where nothing is started
     yet — they help with the first step. While something is being made or edited (a task in the chat, the event,
     the hub builder) Newton already offers the way in the task itself, and the two would argue — so none then.
     A question asked on this page counts as started too. */
  /* Hub is different (Daria, 27.09): the chat there must never stand empty — a tips question for the page (the page's
     advice(): where the accents go, answered with an offer to do it) and three things to try on this page,
     worded with what the builder understands, so each one works on click (Hub.html, ALL_ASKS). They stay after
     an ask too: there's no other hint in Hub. Not while a task or the event is on. */
  const HUB_SUGG = {
    home: ['Try more room', 'Try bigger cards', 'Put rewards first'],
    store: ['Group by category', 'Try bigger cards', 'Show more items'],
    rewards: ['Try bigger tiles', 'Another tile style', 'Try more room'],
    news: ['Less text in the news', 'Show me another look', 'Try more room'],
    leaders: ['Show just the weekly board', 'Try more room', 'Show me another look'],
    login: ['Try more room', 'Show me another look', 'Make it tighter']
  };
  function suggHere() {
    if (chat && page === 'hub') return taskActive() ? [] : [opts.advice ? opts.advice().q : null].filter(Boolean);   // only the page's tips question; edits are at the block's field (UX answers 28.09; HUB_SUGG kept)
    if (!chat || opts.kind() !== 'empty' || taskActive()) return [];
    if (chat.messages.some((m) => m.from === 'you')) return [];
    return (opts.route() === 'home' ? SUGG[AG.homeState()] : PROMPTS[opts.route()]) || [];
  }
  /* examples inside the empty input — what this page is about (Daria, 27.09) */
  function hintsHere() {
    if (page === 'hub') return [opts.advice ? opts.advice().q : null].concat(HUB_SUGG[opts.hubPage()] || HUB_SUGG.home).filter(Boolean);
    const r = opts.route();
    return (r === 'home' ? SUGG[AG.homeState()] : PROMPTS[r]) || [];
  }
  function syncSugg() {
    if (!chat) return;
    const next = suggHere();
    if (JSON.stringify(next) !== JSON.stringify(chat.opts.suggestions || [])) chat.setSuggestions(next);
  }


  /* ================= action cards: what to do (on the page) → the task (in the chat) =================
     A card is what Newton noticed, as a signal; its task in the chat does the work. Every Dashboard page has them. */
  const isDone = (id) => !!AG.state.done[id];
  const hasDraft = (r, title) => (AG.state.drafts[r] || []).some((d) => d.title === title);
  /* cta — what the card leads to (the arrow's label; the task's main button in the chat says the same) */
  /* A card is a signal (Daria, 27.09): a title, one supporting line, and a number only where there is a real one
     (a bar where it is a share). Three levels, so the eye sorts them at once:
     lv 1 — broken right now, money is lost (red, a lightning bolt);  lv 2 — tolerable, but it costs something or runs out
     (orange);  lv 3 — just advice, an opportunity (white). Cards on a page go in that order. Numbers only from what the
     prototype already knows (the funnel, the store, the rewards). */
  const CARD = {
    halloween: { ask: 'Build the Halloween event', lv: 3, sig: { v: '+8–15%', u: 'revenue' }, title: 'Halloween is in 5 weeks', sub: 'Games like yours earn more that week.', cta: 'Build event', hide: () => !!ev() },
    'launch-bonus': { ask: 'Add a launch bonus', lv: 3, to: 'store-promotions', title: 'No launch offer yet', sub: '+20% gems in week one brings first buys.', cta: 'Add bonus',
      hide: () => (AG.state.drafts['store-promotions'] || []).some((d) => /^Launch/.test(d.title)) },
    'welcome-gift': { ask: 'Add a welcome gift', lv: 3, title: 'Nothing greets new players', sub: 'A first-login gift leads them to the store.', cta: 'Add gift', hide: () => hasDraft('marketing-campaigns', 'Welcome gift') },
    'login-gap': { ask: 'Fix the drop at login', lv: 1, sig: { v: '59%', u: 'leave at login', bar: 59 }, title: 'Players get lost at login', sub: 'They can’t find their Player ID.', cta: 'Fix login', hide: () => AG.state.connect >= AG.CONNECT_TOTAL },
    'first-gift': { ask: 'Turn on the first-login gift', lv: 2, title: 'Your first-login gift is off', sub: '100 coins, ready — just turn it on.', cta: 'Turn on', hide: () => gifted() },   // there's a welcome gift already
    'summer-sale': { ask: 'Deal with Summer Sale', lv: 2, sig: { v: '22%', u: 'of weekly revenue', bar: 22 }, title: 'Summer Sale ends tomorrow', sub: 'Extend or replace it in time.', cta: 'Apply' },
    winback: { ask: 'Win back quiet payers', lv: 2, sig: { v: '38', u: 'payers' }, title: 'Weekly buyers went quiet', sub: 'No visits in 14 days.', cta: 'Win them back' },
    'starter-bundle': { ask: 'Add a bundle under $5', lv: 3, title: 'No bundle under $5', sub: 'New players buy cheap first.', cta: 'Add bundle', hide: () => (AG.state.drafts['store-bundles'] || []).length > 0 },
    'gold-chest': { ask: 'Link Gold Chest', lv: 1, sig: { v: '3', u: 'rewards' }, title: 'Gold Chest can’t be delivered', sub: 'Not linked — 2 bundles and day 7 need it.', cta: 'Link it', hide: () => AG.state.applied.goldChest || AG.state.applied.allLinked },
    'item-images': { ask: 'Add images to 3 items', lv: 2, sig: () => ({ v: `${noImg()}/${STORE_ITEMS}`, u: 'items', bar: Math.round(noImg() / STORE_ITEMS * 100) }), title: 'Items have no image', sub: 'I’ll draw them in your game’s style.', cta: 'Add images', hide: () => !noImg() },
    'item-links': { ask: 'Link items to my game', lv: 1, sig: () => ({ v: `${unlinked()}/${STORE_ITEMS}`, u: 'items', bar: Math.round(unlinked() / STORE_ITEMS * 100) }), title: 'Purchases can’t be delivered', sub: 'They aren’t linked to your game.', cta: 'Apply', hide: () => !unlinked() },
    'first-buy': { ask: 'Add an offer for non-buyers', lv: 3, to: 'store-offers', title: 'Non-buyers have no offer', sub: 'A small deal gets the first buy.', cta: 'Add offer', hide: () => hasDraft('store-offers', 'First Buy Deal') },
    'gems-weekend': { ask: 'Add a bonus gems weekend', lv: 3, to: 'store-promotions', title: 'Weekends have no promotion', sub: 'Bonus gems give a reason to buy.', cta: 'Add promotion', hide: () => hasDraft('store-promotions', 'Bonus gems weekend') },
    day7: { ask: 'Change the day 7 reward', lv: 1, sig: { v: '1/7', u: 'days', bar: 14 }, title: 'Day 7 can’t be delivered', sub: 'Its Gold Chest isn’t linked.', cta: 'Change reward', hide: () => AG.state.applied.day7 || AG.state.applied.day7gems || AG.state.applied.goldChest || AG.state.applied.allLinked },
    'double-points': { ask: 'Add a double points weekend', lv: 3, to: 'store-promotions', title: 'Loyalty has no boost', sub: 'A double-points weekend levels players up.', cta: 'Add boost', hide: () => hasDraft('store-promotions', 'Double loyalty points') },
    top3: { ask: 'Add a top-3 prize', lv: 3, to: 'engagement-leaderboards', title: 'No prize for the weekly top 3', sub: 'A prize keeps them racing all week.', cta: 'Add prize', hide: () => AG.state.applied.top3 },
    ach1: { ask: 'Raise the first-purchase reward', lv: 3, to: 'engagement-achievements', sig: { v: '50', u: 'gems' }, title: 'First purchase pays too little', sub: 'The hardest step deserves more.', cta: 'Raise reward', hide: () => AG.state.applied.ach1 },
    'creator-code': { ask: 'Create a creator code', lv: 3, to: 'marketing-codes', title: 'No creator codes yet', sub: 'Each creator brings an audience.', cta: 'Create code', hide: () => hasDraft('marketing-codes', 'CREATOR10') || hasDraft('marketing-codes', 'CREATOR20') },
    /* launch steps, on pages that wait for players */
    'l-verify': { ask: 'Verify my company', lv: 1, sig: () => ({ v: `${AG.state.verify.step}/${AG.VERIFY_TOTAL}`, u: 'done', bar: Math.round(AG.state.verify.step / AG.VERIFY_TOTAL * 100) }), title: 'Payments are blocked', sub: 'Verify your company — review takes longest.', cta: 'Verify', hide: () => AG.verified(),
      dyn: () => (inReview() ? { lv: 2, title: 'Verification is in review', sub: 'Only publishing and payments wait for it.', cta: 'View status' } : {}) },
    'l-connect': { ask: 'Connect my game', lv: 1, sig: () => ({ v: `${Math.min(AG.state.connect, 3)}/3`, u: 'webhooks done', bar: Math.round(Math.min(AG.state.connect, 3) / 3 * 100) }), title: 'Purchases can’t reach players', sub: 'Connect your game with one command.', cta: 'Connect', hide: () => AG.state.connect >= 3 },
    verify: { ask: 'Verify my company', cta: 'Verify', title: 'Verify your company' },
    connect: { ask: 'Connect my game', cta: 'Connect', title: 'Connect your game' },
    'l-publish': { ask: 'Publish my hub', lv: 3, title: 'Your hub is ready to publish', sub: 'Everything that blocks it is done.', cta: 'Publish', hide: () => AG.state.published || !AG.canPublish() },
    'l-find': { ask: 'Set up login from the game', lv: 2, sig: () => ({ v: `${Math.max(0, AG.state.connect - 3)}/2`, u: 'done', bar: Math.max(0, AG.state.connect - 3) * 50 }), title: 'Players can’t reach the hub from the game', sub: 'Add login and a link in the game.', cta: 'Set up', hide: () => AG.state.connect < 3 || AG.state.connect >= AG.CONNECT_TOTAL }   // after the webhooks: one connection card at a time
  };
  const PAGE_CARDS = {
    home: () => ({ 1: ['l-publish', 'l-verify', 'l-connect', 'l-find', 'halloween', 'launch-bonus', 'welcome-gift'],   // l-publish: all done but not live — Home says so (Daria, 28.09: only the banner was left)
      2: ['l-verify', 'l-connect', 'login-gap', 'first-gift', 'halloween'],
      3: ['l-verify', 'l-connect', 'l-find', 'summer-sale', 'winback', 'halloween'] }[AG.homeState()]),   // the launch first, until it's done
    store: () => ['item-links', 'item-images', 'starter-bundle'],
    'store-bundles': () => ['halloween', 'starter-bundle', 'gold-chest'],
    'store-offers': () => ['first-buy', 'gold-chest', 'halloween'],
    'store-currencies': () => ['gems-weekend'],
    'engagement-daily-rewards': () => ['day7', 'halloween'],
    'engagement-loyalty': () => ['double-points'],
    'engagement-leaderboards': () => ['top3'],
    'engagement-achievements': () => ['ach1']
  };
  const LAUNCH_CARD = { verify: 'l-verify', webhooks: 'l-connect', publish: 'l-publish', find: 'l-find' };
  /* a ready start of an empty section, as a card */
  const startCard = (r, i) => { const d = STARTS[r].list[i];
    /* a ready start says what to do and, in one plain sentence, what it is */
    return { lv: 3, ask: d.action, title: d.action, sub: d.line || d.why, cta: STARTS[r].cta, hide: () => hasDraft(r, d.title) }; };
  const cardDef = (id) => (id.startsWith('start:') ? startCard(id.split(':')[1], Number(id.split(':')[2])) : CARD[id]);

  function cards(route) {
    let ids = PAGE_CARDS[route] ? PAGE_CARDS[route]() : [];
    if (STARTS[route]) ids = STARTS[route].list.map((d, i) => `start:${route}:${i}`);
    if (WAIT[route]) { ids = WAIT[route].map((k) => LAUNCH_CARD[k]); ids.push(route.startsWith('analytics') ? 'welcome-gift' : 'creator-code'); }
    /* to — the section a card's task lands in: while that section is closed in the menu, the card is hidden (not deleted) */
    return ids.map((id) => [id, cardDef(id)]).filter(([id, c]) => c && !isDone(id) && !(c.hide && c.hide()) && !(c.to && AG.navOff(c.to)))
      .map(([id, c]) => Object.assign({ id, type: typeOf(id) }, c, typeof c.sig === 'function' ? { sig: c.sig() } : {}, c.dyn ? c.dyn() : {}))
      .sort((a, b) => (a.lv || 3) - (b.lv || 3))   // broken first, then tolerable, then advice
      .slice(0, route === 'home' ? 4 : 3);   // one row of the most important (Home: four — the launch and what earns); the rest come as these are done
  }
  const finish = (id) => AG.save({ done: Object.assign({}, AG.state.done, { [id]: true }) });
  /* what kind of thing a card is (Daria, 28.09): one small typology for every card, signal and alert —
     Launch (steps to go live) · Fix (something is broken or losing money) · Sales (more from the store) ·
     Players (bring them in, keep them) · Event */
  const TYPE_OF = { Launch: ['l-verify', 'l-connect', 'l-publish', 'l-find', 'verify', 'connect'], Fix: ['login-gap', 'gold-chest', 'item-images', 'item-links', 'day7'],
    Sales: ['summer-sale', 'starter-bundle', 'first-buy', 'gems-weekend', 'launch-bonus'], Players: ['welcome-gift', 'first-gift', 'winback', 'double-points', 'top3', 'ach1', 'creator-code'], Event: ['halloween'] };
  const typeOf = (id) => (String(id).startsWith('start:') ? 'Players' : Object.keys(TYPE_OF).find((k) => TYPE_OF[k].includes(id)) || 'Sales');

  /* the tasks: one clean block — what to choose, the choices (first one picked), one action,
     "write my own". The result lands in its section; the block stays as a record of the pick. */
  const SECTION = (r) => (WHERE[r] || '').split(' → ').pop();
  /* after a draft lands (Daria, 27.09 — the quiet block alone said one or two words, nothing about what was made):
     Newton says what he made, in his usual way — a "what I did" line that opens into the details, what it is in plain
     words with the numbers in bold, where it lives, and the way there */
  /* say: the answer in the words of the question (Daria, 28.09 — "you ask one thing, then other words appear": pop-up, draft…);
     then one plain line where to find it */
  const madeMsg = (r, d, say) => (say ? { tools: false,
    did: { title: `Added to ${SECTION(r)}`, count: false, steps: [`${d.title}: ${d.sub}`].concat(d.cols && d.cols[0] ? [`When: ${d.cols[0]}`] : [], ['A draft — it goes live with your hub']) },
    text: `${say}\n\nYou’ll find it in **${SECTION(r)}**.`, actions: [{ label: `Open in ${SECTION(r)}`, act: `go:${r}`, kind: 'tertiary', at: r }] } : {
    tools: false,
    did: { title: `Added a draft to ${SECTION(r)}`, count: false, steps: [`${d.title}: ${d.sub}`].concat(d.cols && d.cols[0] ? [`When: ${d.cols[0]}`] : [], ['Draft — goes live with your hub']) },
    text: `**${d.title}** is ready — ${((x) => x.charAt(0).toLowerCase() + x.slice(1))(String(d.sub || '').replace(/ · /g, ', ')).replace(/(\d[\d,.%+]*(?:\s(?:gems|energy|coins|days?|hero shards?))?)/g, '**$1**')}${d.cols && d.cols[0] ? `, ${d.cols[0].charAt(0).toLowerCase() + d.cols[0].slice(1)}` : ''}.\n\nIt’s a draft in **${SECTION(r)}**: nothing goes live until your hub does.`,
    actions: [{ label: `Open in ${SECTION(r)}`, act: `go:${r}`, kind: 'tertiary', at: r }] });
  /* "Decide for me" wherever there's a choice (Daria, 26.09): Newton takes the recommended one and does it */
  /* the main button says what the card's own button said (Daria, 27.09) */
  const pick = (flow, card, title, options, cta, extra = {}) => chat.say({ tools: false,
    widget: Object.assign({ type: 'options', flow, card, title, options, picked: 0, cta: (cardDef(card) || {}).cta || cta, own: true }, {}, extra.route ? { doneLink: 'Open in ' + SECTION(extra.route) } : {}, extra) }, 700);
  const TASKS = {
    halloween: () => { chat.ask('Build the Halloween event'); const m = chat.messages.slice().reverse().find((x) => x.from === 'you'); if (m) Object.assign(m, { task: true, taskId: 'halloween' }); },
    'launch-bonus': () => pick('draft', 'launch-bonus', 'How big a bonus for launch week?', [
      { title: '+20% gems for 7 days', reply: 'Done. **Every gem pack gives +20% gems** for 7 days after you publish.', draft: { title: 'Launch week bonus', sub: '+20% gems on every gem pack', cols: ['7 days after you publish'] } },
      { title: '+30% gems for 3 days', reply: 'Done. **Every gem pack gives +30% gems** for 3 days after you publish.', draft: { title: 'Launch weekend bonus', sub: '+30% gems on every gem pack', cols: ['3 days after you publish'] } },
      { title: '+10% gems for 14 days', reply: 'Done. **Every gem pack gives +10% gems** for 14 days after you publish.', draft: { title: 'Launch fortnight bonus', sub: '+10% gems on every gem pack', cols: ['14 days after you publish'] } }],
      'Add to Promotions', { route: 'store-promotions' }),
    'welcome-gift': () => pick('draft', 'welcome-gift', 'What should new players get on their first login?', [
      { title: '100 gems', reply: 'Done. **New players get 100 gems** the first time they log in.', draft: { title: 'Welcome gift', sub: 'Pop-up · 100 gems', cols: ['First login on the hub'] } },
      { title: 'A free Energy Refill', reply: 'Done. **New players get a free Energy Refill** the first time they log in.', draft: { title: 'Welcome gift', sub: 'Pop-up · Energy Refill', cols: ['First login on the hub'] } },
      { title: '50 gems + 50 energy', reply: 'Done. **New players get 50 gems and 50 energy** the first time they log in.', draft: { title: 'Welcome gift', sub: 'Pop-up · 50 gems + 50 energy', cols: ['First login on the hub'] } }],
      'Add to Campaigns', { route: 'marketing-campaigns' }),
    'starter-bundle': () => pick('draft', 'starter-bundle', 'Which bundle for a first purchase?', [
      { art: artBundle({ title: 'Night Raider Kit', price: '$4.99' }), title: 'Night Raider Kit · $4.99', sub: '500 gems + XP Booster', reply: 'Done. **Night Raider Kit for $4.99** is in your store — an easy first buy.', draft: { title: 'Night Raider Kit', sub: '500 gems · XP Booster', cols: ['$4.99'] } },
      { art: artBundle({ title: 'Candy Bag', price: '$2.99' }), title: 'Candy Bag · $2.99', sub: '300 gems + 100 energy', reply: 'Done. **Candy Bag for $2.99** is in your store — an easy first buy.', draft: { title: 'Candy Bag', sub: '300 gems · 100 energy', cols: ['$2.99'] } },
      { art: artBundle({ title: 'Pocket Gem Bag', price: '$3.99' }), title: 'Pocket Gem Bag · $3.99', sub: '400 gems', reply: 'Done. **Pocket Gem Bag for $3.99** is in your store — an easy first buy.', draft: { title: 'Pocket Gem Bag', sub: '400 gems', cols: ['$3.99'] } }],
      'Add to Bundles', { route: 'store-bundles' }),
    'first-buy': () => pick('draft', 'first-buy', 'What to offer players who haven’t bought yet?', [
      { title: '500 gems · $1.99', reply: 'Done. **Players who haven’t bought yet get 500 gems for $1.99**, once.', draft: { title: 'First Buy Deal', sub: '500 gems', cols: ['$1.99', 'Non-payers', 'Once per player'] } },
      { title: '300 gems · $0.99', reply: 'Done. **Players who haven’t bought yet get 300 gems for $0.99**, once.', draft: { title: 'First Buy Deal', sub: '300 gems', cols: ['$0.99', 'Non-payers', 'Once per player'] } },
      { title: '1,000 gems · $4.99', reply: 'Done. **Players who haven’t bought yet get 1,000 gems for $4.99**, once.', draft: { title: 'First Buy Deal', sub: '1,000 gems', cols: ['$4.99', 'Non-payers', 'Once per player'] } }],
      'Add to Offers', { route: 'store-offers' }),
    'gems-weekend': () => pick('draft', 'gems-weekend', 'How big a weekend bonus?', [
      { title: '+20% gems every weekend', reply: 'Done. **Every weekend, gem packs give +20% gems.**', draft: { title: 'Bonus gems weekend', sub: '+20% gems on every gem pack', cols: ['Every Sat and Sun'] } },
      { title: '+50% gems, next weekend only', reply: 'Done. **Next weekend, gem packs give +50% gems.**', draft: { title: 'Bonus gems weekend', sub: '+50% gems on every gem pack', cols: ['Next Sat and Sun'] } }],
      'Add to Promotions', { route: 'store-promotions' }),
    'double-points': () => pick('draft', 'double-points', 'When to double the loyalty points?', [
      { title: 'Every weekend', reply: 'Done. **Loyalty points are doubled every weekend.**', draft: { title: 'Double loyalty points', sub: '2 points per $1 spent', cols: ['Every Sat and Sun'] } },
      { title: 'Next weekend only', reply: 'Done. **Loyalty points are doubled next weekend.**', draft: { title: 'Double loyalty points', sub: '2 points per $1 spent', cols: ['Next Sat and Sun'] } }],
      'Add to Promotions', { route: 'store-promotions' }),
    'creator-code': () => pick('draft', 'creator-code', 'Which code should creators share?', [
      { title: 'CREATOR10 · +10% gems', reply: 'Done. **CREATOR10 gives +10% gems** to a creator’s audience.', draft: { title: 'CREATOR10', sub: '+10% gems for a creator’s audience', cols: ['10% bonus'] } },
      { title: 'CREATOR20 · +20% gems', reply: 'Done. **CREATOR20 gives +20% gems** to a creator’s audience.', draft: { title: 'CREATOR20', sub: '+20% gems for a creator’s audience', cols: ['20% bonus'] } }],
      'Add to Codes', { route: 'marketing-codes' }),
    'first-gift': () => pick('choice', 'first-gift', 'Which first-login gift?', [
      { title: 'Keep 100 coins', reply: 'On. **Players get 100 coins** on their first login.' },
      { title: '200 coins', reply: 'On. **Players get 200 coins** on their first login.' },
      { title: '100 coins + Energy Refill', reply: 'On. **100 coins and an Energy Refill** on the first login.' }], 'Turn it on'),
    'summer-sale': () => pick('choice', 'summer-sale', 'What to do with Summer Sale?', [
      { title: 'Extend by 7 days', reply: 'Done. **Summer Sale runs to Oct 4.**' },
      { title: 'Extend by 3 days', reply: 'Done. **Summer Sale runs to Sep 30.**' },
      { title: 'Let it end, start a weekend energy sale', reply: 'Done. **The weekend energy sale starts Saturday.**' }], 'Do it'),
    'gold-chest': () => pick('choice', 'gold-chest', 'Link Gold Chest to', [
      { title: 'chest_gold', sub: 'Closest match by name and price', reply: 'Linked. **2 bundles and day 7 can be delivered now.**', apply: 'goldChest' },
      { title: 'chest_gold_premium', reply: 'Linked. **2 bundles and day 7 can be delivered now.**', apply: 'goldChest' }], 'Link it'),
    'item-links': () => pick('choice', 'item-links', `Link ${unlinked()} items`, [
      { title: 'Link all as matched', sub: 'Gold Chest → chest_gold, Gem Vault → gems_6500 and 2 more', reply: 'Linked. **Every item can be delivered now.**', apply: 'allLinked' },
      { title: 'Show me the list first', page: 'f-sku', reply: 'They’re filtered in the table.' }], 'Do it'),
    'item-images': () => pick('choice', 'item-images', 'Images for 3 items', [
      { title: 'Like your store art', reply: 'Done. **3 images added.**', apply: 'images' },
      { title: 'Flat icons', reply: 'Done. **3 images added.**', apply: 'images' }], 'Use these'),
    day7: () => pick('choice', 'day7', 'What to give on day 7?', [
      { title: 'Legendary Shard', reply: 'Done. **Day 7 is a Legendary Shard now.**', apply: 'day7' },
      { title: '500 gems', reply: 'Done. **Day 7 gives 500 gems now.**', apply: 'day7gems' }], 'Upgrade it'),
    top3: () => pick('choice', 'top3', 'Prize for the weekly top 3', [
      { title: 'Legendary Shard', reply: 'Done. **The weekly top 3 get a Legendary Shard.**', apply: 'top3' },
      { title: '1,000 gems each', reply: 'Done. **The weekly top 3 get 1,000 gems.**', apply: 'top3' }], 'Add the prize'),
    ach1: () => pick('choice', 'ach1', 'First-purchase reward', [
      { title: '200 gems', reply: 'Done. **The first purchase gives 200 gems now.**', apply: 'ach1' },
      { title: 'A Hero Shard', reply: 'Done. **The first purchase gives a Hero Shard now.**', apply: 'ach1' }], 'Raise it'),
    winback: () => pick('draft', 'winback', 'What to offer players who stopped buying?', [
      { title: 'Gem Hoard −30%', sub: 'Email today, 18:00', reply: 'Done. **38 players who stopped buying get an email today at 18:00** with Gem Hoard −30%.', draft: { title: 'Win back quiet payers', sub: 'Email · Gem Hoard −30% · 38 payers', cols: ['14 days without a visit'] } },
      { title: 'A free Energy Refill', sub: 'Email today, 18:00', reply: 'Done. **38 players who stopped buying get an email today at 18:00** with a free Energy Refill.', draft: { title: 'Win back quiet payers', sub: 'Email · Energy Refill · 38 payers', cols: ['14 days without a visit'] } }],
      'Add to Campaigns', { route: 'marketing-campaigns' }),
    verify: () => verifyTask(),
    connect: () => connectTask(),
    'l-publish': () => chat.say({ tools: false, text: 'Players will see it at **pixelraiders.aghanim.store**.', actions: [{ label: 'Publish', act: 'publish', kind: 'primary' }] }, 600)
  };
  /* ================= verification and connecting the game: steps in the chat, not windows (Daria, 27.09) =================
     The same blocks as everywhere: a form Newton filled in as far as he could, one button, "Change" on a passed step.
     Verification goes on from the step you stopped at; the game's connection — three steps, each checked live. */
  const VSTEPS = AG.VSTEPS;
  const vStep = (i) => ({ tools: false, text: VSTEPS[i].lead, widget: { type: 'fields', flow: 'verify', n: i, title: VSTEPS[i].title, step: `${i + 1} of 4`,
    cta: VSTEPS[i].cta, hint: 'Saved as you go.', editable: true, fields: VSTEPS[i].fields() } });
  const approveAct = { label: 'Approve now (prototype)', act: 'approve', kind: 'tertiary' };
  function verifyTask() {
    const v = AG.state.verify;
    if (v.status === 'approved') return chat.say({ tools: false, text: 'Your company is verified. Publishing and payments are on for all your games.' }, 500);
    if (v.status === 'review') return chat.say({ tools: false, text: 'It’s in review. I’ll tell you the moment it’s back — keep working meanwhile.' }, 500);
    chat.say(vStep(Math.min(v.step, VSTEPS.length - 1)), 600);
  }
  const CSTEPS = [
    { title: 'Webhooks', lead: 'Purchases reach players through three webhooks. Your developer runs one command — it walks their AI assistant through the setup.', cta: 'Sent it to my developer',
      waitTitle: 'Waiting for the first events', wait: ['Player verification', 'Item add', 'Item remove'], to: 3,
      fields: [{ label: 'Command for Claude Code or Cursor', value: '/aghanim-webhooks-quick-start' }, { label: 'Test key', value: 'sk_sandbox_••••4f2a', half: true },
        { label: 'Your server endpoint', ph: 'https://api.yourgame.com/aghanim', half: true, sample: 'https://api.pixelraiders.com/aghanim' }] },
    { title: 'Login from the game', lead: 'Players shouldn’t hunt for a Player ID. A button in the game logs them in to the hub.', cta: 'It’s in the game',
      waitTitle: 'Waiting for the first login', wait: ['First login from the game'], to: 4, fields: [{ label: 'Login link for the button', value: 'pixelraiders://hub-login' }] },
    { title: 'Link to the hub', lead: 'Last one: a link in the game’s menu that opens your hub.', cta: 'It’s in the game',
      waitTitle: 'Waiting for the first visit', wait: ['First visit from the game'], to: 5, fields: [{ label: 'Hub link', value: 'https://pixelraiders.aghanim.store' }] }
  ];
  const cAt = () => (AG.state.connect < 3 ? 0 : AG.state.connect - 2);   // webhooks 0–2 → step 1, then login, then the link
  const cStep = (i, lead) => ({ tools: false, text: lead || CSTEPS[i].lead, widget: { type: 'fields', flow: 'connect', n: i, title: CSTEPS[i].title, step: `${i + 1} of 3`,
    cta: CSTEPS[i].cta, fields: CSTEPS[i].fields.map((f) => Object.assign({}, f)) } });
  function connectTask() {
    const i = cAt();
    if (i >= CSTEPS.length) return chat.say({ tools: false, text: 'Your game is connected: purchases reach players, and players find the hub from the game.' }, 500);
    chat.say(cStep(i), 600);
  }
  function stepDone(msg, data) {
    if (data.flow === 'verify') {
      data.fields.forEach((f) => { if (!f.value && f.sample) f.value = f.sample; });
      const redo = data.redo; chat.widget(msg.id, { done: true, redo: false }); if (redo) return;
      const n = data.n + 1;
      if (n < VSTEPS.length) { AG.save({ verify: { step: n, status: 'draft' } }); chat.say(vStep(n), 500); return; }
      AG.save({ verify: { step: AG.VERIFY_TOTAL, status: 'review' } }); AG.toast('Sent for review');
      chat.say({ tools: false, text: 'Sent for review. I’ll tell you the moment it’s back — only publishing and payments wait for it.' }, 500);
      return;
    }
    /* connect: the step is checked live, then the next one comes */
    data.fields.forEach((f) => { if (!f.value && f.sample) f.value = f.sample; });
    const s = CSTEPS[data.n]; chat.widget(msg.id, { done: true, redo: false });
    chat.say({ tools: false, widget: { type: 'working', kicker: s.waitTitle, title: s.waitTitle, steps: s.wait, at: 0, pct: 0 } }, 400).then((m) => {
      let i = 0;
      const tick = () => {
        i += 1; chat.widget(m.id, { at: i, pct: Math.round((i / s.wait.length) * 100) });
        if (i < s.wait.length) return setTimeout(tick, 700);
        setTimeout(() => {
          chat.remove(m.id); AG.save({ connect: Math.max(AG.state.connect, s.to) });
          const n = data.n + 1;
          if (n < CSTEPS.length) chat.say(cStep(n, `Received. ${CSTEPS[n].lead}`), 500);
          else chat.say({ tools: false, text: '**Connected.** Purchases reach players, and players find the hub from the game.' }, 500);
        }, 500);
      };
      setTimeout(tick, 700);
    });
  }

  /* "for me" on the launch (Daria, 27.09): verification — Newton fills the rest from what he knows and sends it for review;
     the game — he sends the setup to your developer and watches each part arrive */
  function workThen(title, steps, done) {
    chat.say({ tools: false, widget: { type: 'working', ai: true, kicker: title, title, steps, at: 0, pct: 0 } }, 500).then((m) => {
      let i = 0;
      const tick = () => { i += 1; chat.widget(m.id, { at: i, pct: Math.round((i / steps.length) * 100) }); if (i < steps.length) return setTimeout(tick, pace('tick')); setTimeout(() => { chat.remove(m.id); done(); }, pace('after')); };
      setTimeout(tick, pace('tick'));
    });
  }
  function verifyForMe() {
    dropOffer('verify');
    if (AG.verified() || inReview()) return verifyTask();
    chat.push({ from: 'you', text: 'Verify my company for me' });
    workThen('Filling in your verification', VSTEPS.map((x) => x.title), () => {
      AG.save({ verify: { step: AG.VERIFY_TOTAL, status: 'review' } }); AG.toast('Sent for review');
      chat.say({ tools: false, text: 'Sent for review. I filled it from your App Store page — you can change anything while it’s checked. Only publishing and payments wait for it.' }, 400);
    });
  }
  function connectForMe() {
    dropOffer('connect');
    if (AG.state.connect >= AG.CONNECT_TOTAL) return connectTask();
    chat.push({ from: 'you', text: 'Send the setup to my developer' });
    workThen('Waiting for your developer', ['Player verification', 'Item add', 'Item remove', 'Login from the game', 'Link to the hub'].slice(Math.min(AG.state.connect, 5)), () => {
      AG.save({ connect: AG.CONNECT_TOTAL });
      chat.say({ tools: false, text: 'I sent your developer the setup, and everything came through: **purchases reach players, and players find the hub from the game.**' }, 400);
    });
  }

  /* a ready start: Newton fills the form, one click adds it */
  function startTask(id) {
    const [, r, i] = id.split(':'), st = STARTS[r], d = st.list[Number(i)];
    chat.say({ tools: false,
      widget: { type: 'fields', flow: 'start', route: r, src: Number(i), title: d.title, cta: STARTS[r].cta, fields: [
        { label: 'Name', value: d.title, newton: true },
        { label: 'What players get', value: d.sub, newton: true },
        { label: st.cols[1], value: d.col, newton: true }] } }, 600);
  }
  /* the same card clicked again while its task is still open: no second copy — Newton shows the open one */
  function openAlready(id) {
    const msgs = chat.messages, asked = msgs.slice().reverse().find((m) => m.taskId === id);
    if (!asked || asked.archived) return false;                           // put away on an earlier visit: a fresh start, not a jump to something hidden
    if (id === 'halloween' && !ev()) return false;                        // the event was reset: its old ask is stale
    const reply = msgs.slice(msgs.indexOf(asked) + 1).find((m) => m.from === 'newton' && !m.typing);
    if (reply && reply.widget && reply.widget.done) return false;          // finished: a new run is fine
    actives()[showing] = asked.id; saveStore(); syncWork();              // put away in a strip: it opens again
    const n = document.querySelector(`#nw-chat [data-mid="${(reply || asked).id}"]`);
    if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); n.classList.remove('is-ping'); void n.offsetWidth; n.classList.add('is-ping'); }
    return true;
  }
  const ALIAS = { 'l-verify': 'verify', 'l-connect': 'connect', 'l-find': 'connect', 'login-gap': 'connect' };
  /* Add item / bundle / offer and changing an item — in the chat, like everything else (Daria, 27.09: no side panels).
     Newton fills it in from the store (name, price, what's inside), shows the card as players will see it; the dice
     gives another version, every field can be typed over, "Decide for me" adds it as it is. */
  const ADD = {
    store: { ask: 'Add an item', title: 'New item', cta: 'Add item', pool: [
      ['Mega Gem Chest', '$19.99', '3,000 gems'], ['Energy Pack', '$2.99', '5 Energy Refills'], ['Hero Chest', '$9.99', '10 hero shards']] },
    'store-bundles': { ask: 'Add a bundle', title: 'New bundle', cta: 'Add bundle', pool: [
      ['Raid Night Bundle', '$14.99', '2,000 gems · 5 Energy Refills · 1 hero shard'], ['Weekend Warrior', '$7.99', '800 gems · 3 Energy Refills'], ['Legend Pack', '$29.99', '5,000 gems · 3 Legendary Shards']] },
    'store-offers': { ask: 'Add an offer', title: 'New offer', cta: 'Add offer', pool: [
      ['First Raid Offer', '$1.99', '500 gems · 1 Energy Refill'], ['Comeback Deal', '$4.99', '1,200 gems · 2 XP Boosters'], ['Double Gems Day', '$9.99', '2,400 gems, twice the usual']] } };
  AG.chat.formArt = (d) => ((d.flow === 'add' || d.flow === 'edit') && d.fields
    ? { k: 'bundle', d: { title: d.fields[0].value || 'New item', contents: d.fields[2] ? d.fields[2].value : '', price: d.fields[1].value || '$—' } } : null);
  function formTask(id) {
    const [kind, arg] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (kind === 'add') {
      const a = ADD[arg], v = a.pool[0];
      chat.push({ from: 'you', text: a.ask, task: true, taskId: id });
      chat.say({ tools: false, text: 'I’ve filled it in from your store — change anything, or let me add it as it is.',
        widget: { type: 'fields', flow: 'add', route: arg, title: a.title, cta: a.cta, reroll: 'Another one', pool: a.pool,   // filled in already: its own button is the decision
          fields: [{ label: 'Name', value: v[0], newton: true }, { label: 'Price', value: v[1], newton: true, hint: 'Rounded by your price template' }, { label: 'What’s inside', value: v[2], newton: true }] } }, 700);
      return;
    }
    const it = AG.items.find((x) => x.id === arg); if (!it) return;
    chat.push({ from: 'you', text: `Change ${it.name}`, task: false, taskId: id });   // a quick form: the panel keeps its width
    chat.say({ tools: false, widget: { type: 'fields', flow: 'edit', route: 'store', item: it.id, title: it.name, cta: 'Save',
      fields: [{ label: 'Name', value: it.name }, { label: 'Price', value: it.price, hint: 'Rounded by your price template' }, { label: 'What’s inside', value: it.sub },
        { label: 'Item in your game (SKU)', value: it.sku || '', hint: it.sku ? '' : 'Link it to an item in your game, otherwise the purchase can’t be delivered.' }] } }, 600);
  }
  /* a thing you've started is taken off Newton's "Decide everything for me" in his greeting (the button would start it a
     second time); what's left stays on the button, and when nothing is left the button goes */
  function dropOffer(id) {
    chat.messages.filter((m) => String(m.sid || '').startsWith('hi:') && (m.actions || []).length).forEach((m) => {
      const acts = [];
      m.actions.forEach((a) => {
        const d = /^do(-all)?:(.+)$/.exec(a.act || ''); if (!d) { acts.push(a); return; }
        const rest = d[2].split(',').filter((x) => (ALIAS[x] || x) !== (ALIAS[id] || id));
        if (rest.length) acts.push(...forMe(rest));
      });
      if (acts.map((a) => a.act).join() !== m.actions.map((a) => a.act).join()) chat.update(m.id, { actions: acts });
    });
  }
  function task(id) {
    if (!chat) return;
    /* you started something yourself while Newton works through a plan (UX answers 28.09): it waits its turn — the plan
       finishes, then Newton opens it. A quiet word says so. (stopPlan stays in the code, nothing calls it now.) */
    if (planning && !planning.inner) {
      if (!planning.queue.includes(id)) { planning.queue.push(id); chat.opts.muffle = false; chat.newton({ tools: false, text: 'Got it — I’ll open it as soon as I finish this.' }); chat.opts.muffle = true; }
      return;
    }
    dropOffer(id);
    if (greetT) { clearTimeout(greetT); greetT = 0; chat.stopThinking(); }   // the greeting on its way is dropped: you've started something
    id = ALIAS[id] || id;
    userMin = false; away = false; awayClicks = 0;    // a card click wants Newton back, on its task
    if (showing !== ctxKey()) { store.carry = null; enter(); }   // a card on this page belongs to this page's conversation
    if (openAlready(id)) return sync(true);
    if (/^(add|edit):/.test(id)) {
      formTask(id);
      const mine = chat.messages.slice().reverse().find((m) => m.from === 'you' && m.taskId === id);
      if (mine) { actives()[showing] = mine.id; saveStore(); syncWork(); }
      return;
    }
    const c = cardDef(id);
    /* what the person "said" by clicking: the intent, not Newton's finding */
    /* a task that only opens a window (verify, connect, publish) is one line and a button — the panel doesn't grow for it */
    const light = ['l-publish', 'verify', 'connect'].includes(id);   // verify and connect are steps in the chat, nothing lands on the page: the panel doesn't grow (it used to grow, then snap back — Daria, 27.09)
    if (id !== 'halloween') chat.push({ from: 'you', text: c.ask || `${c.cta}: ${c.title}`, task: !light, taskId: id });
    if (id.startsWith('start:')) startTask(id); else TASKS[id]();
    const asked = chat.messages.slice().reverse().find((m) => m.from === 'you' && m.taskId === id);
    if (asked) { actives()[showing] = asked.id; saveStore(); syncWork(); }
  }

  /* canned answers for the prototype; the event has its own script below */
  const ANSWERS = [
    /* Hub: the tips question for this page (Daria, 27.09) — a few lines, then an offer to do it (the page applies it) */
    { get match() { return page === 'hub' && opts.advice ? [opts.advice().q.toLowerCase()] : []; }, delay: 700, thinking: 'Looking at this page',
      reply: () => opts.advice().reply },
    /* a typed request about the hub's look: the page says what it understands (keys), does it and gives back the line Newton says */
    { get match() { return page === 'hub' && opts.look ? (opts.look().keys || []) : []; }, delay: 500,
      reply: (chat, text) => { const line = opts.onLook({ ask: String(text).toLowerCase() }); const did = opts.did && opts.did();
        return line ? Object.assign({ text: line, tools: false }, did ? { did } : {}) : FALLBACK; } },   // what changed shows above the answer
    { match: ['halloween', 'event'], reply: (chat) => { start(chat); return Promise.resolve(); } },
    { match: ['wednesday', 'revenue drop'], thinking: 'Checking Wednesday', delay: 1100, reply: {
      text: 'Wednesday dipped at checkout, not on the hub.',
      widget: { type: 'stats', value: '$12,480', label: 'Revenue, last 7 days', delta: '+18%', up: true,
        bars: [[62, 'Th'], [58, 'Fr'], [70, 'Sa'], [74, 'Su'], [66, 'Mo'], [64, 'Tu'], [31, 'We', 'is-low']],
        read: 'Visits held. **Three payments failed** on one card provider.', source: 'Analytics → Transactions', cta: 'Open failed payments' } } },
    { match: ['verify first', 'why verify'], delay: 700, reply: {
      text: 'Review takes the longest, and it’s the only thing blocking payments. Everything else works without it.',
      actions: [{ label: 'Start verification', act: 'verify' }] } }
  ];
  /* an answer the prototype doesn't have: the line is conversation, the event it offers to build is a block */
  const FALLBACK = { tools: false, text: 'This answer isn’t in the prototype yet.',
    /* the event is offered as the same card as on the pages (Daria, 28.09: one look for every card, compact in the chat) */
    widget: { type: 'signal', lv: 3, kind: 'Event', title: 'Halloween is in 5 weeks', sub: 'Games like yours earn more that week', sig: { v: '+8–15%', u: 'revenue' }, cta: 'Build event', q: 'Build the Halloween event' } };

  /* ================= the event flow, one piece at a time ================= */
  let chat = null, page = '', opts = {};

  function start(c) {
    const e = ev();
    if (e && e.built) {
      c.say({ text: `**${e.idea.title}** is already built for ${DATES}.`, actions: [{ label: 'Show event', act: 'summary' }] });
      return;
    }
    /* it's under way in another page's conversation: one line and the way back to it, not a second copy */
    if (e && e.thread && e.thread !== showing) {
      c.say({ text: `**${e.idea ? e.idea.title : 'The Halloween event'}** is under way.`, actions: [{ label: 'Continue', act: 'continue-event' }] });
      return;
    }
    if (!e) AG.save({ event: { step: 'idea', thread: showing, startedAt: Date.now() } });   // the event lives in the conversation it was started in; the clock is for "built in 1 min 42 s"
    c.say({ tools: false,
      widget: { editable: true, type: 'options', flow: 'idea', step: '1 of 5', title: `Idea for ${DATES}`, options: withArt(IDEAS.slice(0, 3), artIdea), pool: withArt(IDEAS, artIdea), picked: 0, cta: 'Build this event', decide: 'Decide everything for me', reroll: 'Other ideas', own: true } }, 900);
  }

  /* four clean blocks: the step, the choices, one action. The page on the left shows where it went. */
  const STEPS = {
    bundle() {
      chat.say({ tools: false,
        widget: { editable: true, type: 'options', flow: 'bundle', step: '2 of 5', title: 'Bundle', options: withArt(BUNDLES.slice(0, 3), (b) => artBundle(Object.assign({ season: true }, b))), pool: withArt(BUNDLES, (b) => artBundle(Object.assign({ season: true }, b))), picked: 0, cta: 'Add bundle', decide: 'Decide everything for me', reroll: 'Other bundles', own: true } }, 900);
    },
    rewards() {
      chat.say({ tools: false,
        widget: { editable: true, type: 'options', flow: 'rewards', step: '3 of 5', title: 'Login gifts', options: withArt(REWARDS, artDays), picked: 0, cta: 'Add gifts', decide: 'Decide everything for me', own: true } }, 900);
    },
    banner() {
      const e = ev(), list = withArt(HEADLINES(e.idea, e.bundle), (h) => artBanner(h, e.bundle));
      chat.say({ tools: false,
        widget: { editable: true, type: 'options', flow: 'banner', step: '4 of 5', title: 'Hub banner', options: list.slice(0, 3), pool: list, picked: 0, cta: 'Add banner', decide: 'Decide everything for me', reroll: 'Other headlines', own: true } }, 900);
    },
    push() {
      const e = ev();
      chat.say({ tools: false,
        /* the words can be rolled like any other step; when and who are set by Newton — a period and an audience,
           shown as their real controls, not editable in the prototype (Daria, 27.09) */
        widget: { editable: true, type: 'fields', flow: 'push', step: '5 of 5', title: 'Push', cta: 'Add push', reroll: 'Other words',
          pool: [[`${e.idea.title} is here`, `${e.bundle.title} is in the store. A gift waits every day.`],
            ['The moon is up. So are the prizes.', `${e.bundle.title} is live for 7 nights only.`],
            ['7 nights. 7 gifts.', `Log in every night this week — day 7 is the big one.`],
            ['Trick, treat, raid.', `${e.bundle.title} and daily gifts are on the hub.`]],
          fields: [
          { label: 'Title', value: `${e.idea.title} is here`, newton: true },
          { label: 'Text', value: `${e.bundle.title} is in the store. A gift waits every day.`, newton: true },
          { label: 'When', value: 'Oct 25 – 31, 18:00', kind: 'range', newton: true, half: true },
          { label: 'Who', value: 'All players', kind: 'select', newton: true, half: true }] } }, 900);
    },
    summary() {
      if (!ev().built) setEv({ built: true, builtAt: Date.now() });
      chat.say({ tools: false, widget: packWidget() }, 900).then((m) => setTimeout(() => AG.magic(document.querySelector(`#nw-chat [data-mid="${m.id}"] .cw`)), 60));
    }
  };

  /* how long it took you: from "Build event" to the finished card */
  const took = (e) => { const t = Math.max(20, Math.round(((e.builtAt || Date.now()) - (e.startedAt || Date.now() - 100000)) / 1000));
    return t < 60 ? `${t} s` : t < 600 ? `${Math.floor(t / 60)} min ${t % 60 ? `${t % 60} s` : ''}`.trim() : 'a few minutes'; };
  /* everything Newton did under the hood, and where he put it (Daria, 27.09 — show how much was done for you) */
  function evDid(e) {
    const p = e.push || {};
    return [
      `Picked the idea **${e.idea.title}** for ${DATES}`,
      `Made the bundle **${e.bundle.title}** — ${e.bundle.contents || e.bundle.sub || ''}, ${e.bundle.price}`,
      'Priced it by your rounding rule and used only items linked to your game',
      'Put it in **Store → Bundles** as a draft, tagged Halloween',
      '7 login gifts with a Gold Chest on day 7 → **Engagement → Daily rewards**, instead of the regular cycle for these dates',
      `Drew the banner **“${e.banner.title}”** in your hub’s style → **Hub → Home**`,
      `Wrote the push **“${p.title || e.idea.title + ' is here'}”** → **Marketing → Campaigns**, ${p.when || 'Oct 25 – 31, 18:00'}, ${(p.who || 'All players').toLowerCase()}`,
      'Checked your LiveOps frequency — no clash with other campaigns',
      'Tied all four to Oct 25 – 31, so they start and stop together',
      'Kept everything as drafts — nothing is public until you schedule'];
  }
  /* days to the event's first day (Oct 25), for the card's quiet countdown */
  const untilStart = () => { const now = new Date(), start = new Date(now.getFullYear(), 9, 25), d = Math.ceil((start - now) / 864e5);
    return d > 1 ? `Starts in ${d} days` : d === 1 ? 'Starts tomorrow' : d === 0 ? 'Starts today' : 'Running now'; };
  function packWidget() {
    const e = ev(), steps = evDid(e);
    return { type: 'pack', flow: 'pack', step: '', title: '', scheduled: !!e.scheduled, scheduledLabel: 'Scheduled · Oct 25',
      art: artBanner(e.banner || { title: e.idea.title }, e.bundle),
      /* verification decides the last line: approved — schedule; in review — schedule now, it waits for approval;
         not sent — verify first (said once, in the hint under the button) */
      /* one heading says where it stands (Daria, 28.09 — "All set in 1 min 42 s" was clutter); the countdown sits quietly at the bottom right */
      /* verification doesn't show here in the prototype (Daria, 28.09): the event reads as if it doesn't depend on it */
      heading: 'All set — one click to launch',
      liveHeading: 'It’s on — live Oct 25 to 31',
      countdown: untilStart(),
      did: { title: `${steps.length} things done for you`, steps },
      rows: [
        { sec: 'Bundles', title: `${e.bundle.title} · ${e.bundle.price}`, to: ['dashboard', 'store-bundles'] },
        { sec: 'Daily rewards', title: '7 login gifts', to: ['dashboard', 'engagement-daily-rewards'] },
        { sec: 'Hub', title: 'Banner on Home', to: ['hub', 'home'] },
        { sec: 'Campaigns', title: `Push to ${((e.push && e.push.who) || 'All players').toLowerCase()}, daily at 18:00`, to: ['dashboard', 'marketing-campaigns'] }],
      cta: 'Schedule',
      blocked: '', blockedCta: 'Verify company' };
  }
  /* the event card follows a changed step */
  function refreshPack() {
    const m = chat.messages.slice().reverse().find((x) => x.widget && x.widget.type === 'pack');
    if (m) chat.widget(m.id, packWidget());
  }
  /* the event card's last line follows verification (sent for review, approved) — also in a saved conversation */
  function syncPack() {
    const m = chat && chat.messages.slice().reverse().find((x) => x.widget && x.widget.type === 'pack'), e = ev();
    if (!m || !e || !e.idea || !e.bundle || !e.banner) return;
    const w = packWidget(), d = m.widget, keys = ['heading', 'liveHeading', 'countdown', 'lead', 'liveLead', 'blocked', 'title', 'step', 'rows', 'cta', 'did'];
    const pick = (o) => JSON.stringify(keys.map((k) => (k === 'did' ? (o.did || {}).title : o[k])));
    if (pick(w) !== pick(d)) chat.widget(m.id, Object.fromEntries(keys.map((k) => [k, w[k]])));   // also brings a card saved with older words up to date
  }
  /* conversations and drafts saved before the words were edited (27.09) read the same as new ones */
  const STEP_TITLE = { idea: `Idea for ${DATES}`, rewards: 'Login gifts', banner: 'Hub banner', push: 'Push' };
  function freshWords() {
    chat.messages.forEach((m) => { const t = m.widget && STEP_TITLE[m.widget.flow]; if (t && m.widget.title !== t) chat.widget(m.id, { title: t }); });
    const camp = AG.state.drafts['marketing-campaigns'] || [];
    if (camp.some((d) => (d.cols || [])[0] === '38 payers, 14 days away')) {
      AG.save({ drafts: Object.assign({}, AG.state.drafts, { 'marketing-campaigns': camp.map((d) => ((d.cols || [])[0] === '38 payers, 14 days away'
        ? Object.assign({}, d, { sub: `${d.sub} · 38 payers`, cols: ['14 days without a visit'] }) : d)) }) });
    }
  }
  /* go to a page yourself (a finished result's "Open in …"): no conversation comes along */
  function openPage([p, hash]) {
    if (p === page) { if (location.hash.slice(1) !== hash) location.hash = hash; return; }
    AG.go(`${p === 'hub' ? 'Hub' : 'Dashboard'}.html#${hash}`);
  }
  /* switch the page on the left, then let Newton go on. Across pages the next step waits in the state. */
  function goTo(to, next) {
    const [p, hash] = to;
    lookAtPage = false; away = false; awayClicks = 0;  // Newton moves the work on: the width follows the step again
    /* Newton takes you to another page mid-task: this conversation comes along (it's the same work) */
    if (p !== page || (p === 'dashboard' && opts.route() !== hash)) { store.carry = { key: showing, moved: true }; saveStore(); }
    if (p === page) {
      if (location.hash.slice(1) !== hash) location.hash = hash;
      if (next) setTimeout(() => run(next), pace('step'));   // the page settles and the new row shows before the next step
    } else {
      if (next) setEv({ pending: next });
      AG.go(`${p === 'hub' ? 'Hub' : 'Dashboard'}.html#${hash}`);
    }
  }
  function run(step) {
    const n = document.querySelector('.is-new');
    if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' });
    STEPS[step]();
  }
  const put = (key, val) => AG.save(Object.assign({ event: Object.assign({}, ev(), { [key]: val }) }, flash(key)));

  /* "Write my own": the input takes the next line as this step's choice — built from the picked one,
     so the rest (price, days, contents) stays filled in */
  function writeOwn(msg, data) {
    const input = document.querySelector('#nw-chat .chat__in');
    chat.hint('Write it your way…'); if (input) input.focus();
    chat.opts.onSend = (text) => {
      delete chat.opts.onSend;
      chat.hint(null);
      const said = chat.messages[chat.messages.length - 1]; if (said && said.from === 'you') chat.remove(said.id);   // it shows inside the block
      const base = data.options[data.picked] || data.options[0];
      const own = Object.assign({}, base, { title: text, sub: '' }, base.draft ? { draft: Object.assign({}, base.draft, { title: text }) } : {}, base.reply ? { reply: `Done. **${text}**` } : {});
      if (base.art) own.art = base.art.split(base.title).join(text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));   // the picture shows your words
      delete own.page; delete own.rolled;
      chat.widget(msg.id, { options: data.options.concat([own]), picked: data.options.length });
      setTimeout(() => onAction('create', { chat, msg, data: msg.widget }), 400);
    };
  }

  /* "Decide for me" in the event (Daria, 26.09): Newton takes the recommended option of this step and of every
     step after it — the whole event comes out in one go. The working block shows the pieces being made, then
     the event card appears with the magic. Nothing is lost: every piece is a draft in its section, each step
     can still be changed from the card. */
  function decideEvent(msg, data) {
    const e = ev() || {}, rec = data.options[data.rec == null ? 0 : data.rec];
    chat.widget(msg.id, { done: true, picked: data.options.indexOf(rec) });
    const got = Object.assign({}, e, { [data.flow]: rec });
    const idea = got.idea || IDEAS[0];
    const bundle = got.bundle || BUNDLES[0];
    const plan = [
      ['bundle', 'Bundle', bundle],
      ['rewards', 'Login gifts', got.rewards || REWARDS[0]],
      ['banner', 'Hub banner', got.banner || HEADLINES(idea, bundle)[0]],
      ['push', 'Push', got.push || { title: `${idea.title} is here`, text: `${bundle.title} is in the store. A gift waits every day.`, when: 'Oct 25 – 31, 18:00', who: 'All players' }]];
    /* slow enough to read (Daria, 28.09: it flew by): each line says what was picked, ~1.3 s a piece */
    const said = (k, v) => (k === 'bundle' ? `Bundle — ${v.title}` : k === 'rewards' ? `Login gifts — ${v.title || '7 days'}` : k === 'banner' ? `Hub banner — ${v.title || v.headline || 'on Home'}` : `Push — ${v.when || 'daily at 18:00'}`);
    const STEP_MS = pace('evStep'), END_MS = pace('evEnd');
    chat.say({ tools: false, widget: { type: 'working', ai: true, kicker: 'Deciding for you', title: idea.title, steps: plan.map(([k, , v]) => said(k, v)), at: 0, pct: 0 } }, 400).then((m) => {
      let i = 0;
      const tick = () => {
        i += 1;
        chat.widget(m.id, { at: i, pct: Math.round((i / plan.length) * 100) });
        if (i < plan.length) return setTimeout(tick, STEP_MS);
        setTimeout(() => {
          chat.remove(m.id);
          AG.save({ event: Object.assign({}, ev(), { idea }, ...plan.map(([k, , v]) => ({ [k]: v })), { built: true, builtAt: Date.now(), pending: null }) });
          const card = chat.newton({ tools: false, widget: packWidget() });
          setTimeout(() => AG.magic(document.querySelector(`#nw-chat [data-mid="${card.id}"] .cw`)), 60);
        }, END_MS);   // the last line gets its tick and a moment before the card
      };
      setTimeout(tick, STEP_MS);
    });
  }

  function onAction(act, ctx) {
    const { msg, data } = ctx;
    if (act === 'cancel') return cancelFrom(msg);
    if (act === 'submit' && data && (data.flow === 'verify' || data.flow === 'connect')) return stepDone(msg, data);
    if (data && data.flow === 'log' && act === 'undo') {
      const r = data.rows[ctx.i], undone = Object.assign({}, AG.state.undone, { [`${data.key}:${r.n != null ? r.n : ctx.i}`]: !!r.undone });
      return AG.save({ undone });   // the row itself says "Undone"
    }
    /* a problem fixed right here (Daria, 27.09): you stay where you are; Newton says what he did, and the way to see it
       is a button — go there if you want to */
    if (ctx.kind === 'alert') {
      if (act.startsWith('task:')) return task(act.slice(5));   // a problem from Home: its own task, right here in the chat
      if (act === 'link-all') {
        const was = AG.items.filter((it) => !it.sku);
        AG.save(Object.assign({ applied: Object.assign({}, AG.state.applied, { allLinked: true }) }, flash('apply:allLinked')));
        return chat.newton({ did: { count: false, title: `Linked ${was.length} items`, steps: was.map((it) => `${it.name} → ${it.sku}`) },
          text: 'Done. **Every item can be delivered now.**', actions: [{ label: 'Open in Store', act: 'go:store', kind: 'tertiary', at: 'store' }] });
      }
      if (act === 'gen-images') {
        const was = AG.items.filter((it) => !AG.hasImage(it));
        AG.save(Object.assign({ imagesFixed: true }, flash('apply:images')));
        return chat.newton({ did: { count: false, title: `Drew ${was.length} images`, steps: was.map((it) => it.name) },
          text: 'Done. **Every item has a picture now**, in your game’s style.', actions: [{ label: 'Open in Store', act: 'go:store', kind: 'tertiary', at: 'store' }] });
      }
      if (act.startsWith('go:')) return openPage(['dashboard', act.slice(3)]);
      return;
    }
    /* signals */
    if (ctx.kind === 'msg') {
      if (act.startsWith('open:')) { const [k, id] = act.slice(5).split('|'); return onPin(chat, { go: k, id: Number(id) }); }
      if (act.startsWith('do-all:')) { const a = msg && (msg.actions || []).find((x) => x.act === act); if (msg && msg.id) chat.update(msg.id, { actions: (msg.actions || []).filter((x) => x.act !== act) }); return doAll(act.slice(7).split(','), a && a.label); }
      if (act.startsWith('do:')) { const a = msg && (msg.actions || []).find((x) => x.act === act); if (msg && msg.id) chat.update(msg.id, { actions: (msg.actions || []).filter((x) => x.act !== act) }); return doAll([act.slice(3)], a && a.label); }   // one job goes the same way as several   // the other offer stays
      if (act === 'later') return chat.update(msg.id, { actions: [], note: 'OK, I’ll bring it up next week.' });
      if (act === 'dismiss') return chat.update(msg.id, { actions: [], note: 'Hidden. I’ll remind you in a week.' });
      if (act === 'extend') { chat.update(msg.id, { actions: [], note: 'Extended to Oct 4.' }); return toast('Summer Sale extended by 1 week'); }
      if (act === 'ok') return chat.update(msg.id, { actions: [], note: 'Noted.' });
      if (act === 'gen-images') { chat.update(msg.id, { actions: [], note: `Done. ${noImg()} images added.` }); AG.save(Object.assign({ imagesFixed: true }, flash('apply:images'))); return; }
      if (act === 'verify') return task('verify');     // steps in the chat, not a window (Daria, 27.09)
      if (act === 'connect') return task('connect');
      if (act === 'approve') { AG.save({ verify: { step: AG.VERIFY_TOTAL, status: 'approved' } }); chat.update(msg.id, { actions: [] }); return chat.say({ tools: false, text: 'Verified. Publishing and payments are on.' }, 500); }
      if (act === 'open-live') return window.open(LIVE_URL, '_blank');
      if (act === 'publish') { if (!AG.canPublish()) return toast(AG.publishBlocker()); AG.save({ published: true }); finish('l-publish'); return chat.say(liveMsg(), 400); }
      if (act === 'summary') return chat.say({ tools: false, widget: packWidget() }, 500);
      if (act === 'continue-event') return ev() && continueAt(ev().thread);
      if (act.startsWith('go:')) return openPage(['dashboard', act.slice(3)]);
      if (act.startsWith('hub:')) return openPage(['hub', act.slice(4)]);
      if (act.startsWith('page:')) return opts.onPage(act.slice(5));
      return;
    }
    /* a hub page setting from its widget: the Hub page applies it and the canvas shows it */
    if (data && data.flow === 'hub-setting') return opts.onSetting && opts.onSetting(act, ctx);
    /* "write my own": the next thing typed becomes this step's choice */
    if (act === 'own') return writeOwn(msg, data);
    if (act === 'open-done') { if (page === 'dashboard') location.hash = data.route; else AG.go(`Dashboard.html#${data.route}`); return; }

    /* a task from an action card */
    /* a task from a card, "Decide for me": the recommended option, then the same as the main button */
    if ((data.flow === 'draft' || data.flow === 'choice') && act === 'decide') { data.picked = data.rec == null ? 0 : data.rec; act = 'create'; }
    if (data.flow === 'draft' && act === 'create') {
      const o = data.options[data.picked], r = data.route;
      chat.widget(msg.id, { done: true, doneLink: null });   // the way there is in the message below
      const drafts = Object.assign({}, AG.state.drafts, { [r]: [...(AG.state.drafts[r] || []), o.draft] });
      AG.save(Object.assign({ drafts, done: Object.assign({}, AG.state.done, { [data.card]: true }) }, flash('draft:' + r + ':' + o.draft.title)));
      goTo(['dashboard', r]);
      chat.say(madeMsg(r, o.draft, o.reply), 700);
      setTimeout(() => { const n = document.querySelector('.is-new'); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
      return;
    }
    if (data.flow === 'choice' && act === 'create') {
      const o = data.options[data.picked];
      chat.widget(msg.id, { done: true });
      if (o.page) { opts.onPage(o.page); return chat.say(o.reply, 400); }   // "show me first": nothing changes, the card stays
      /* what changed on the page shimmers there (flash → the page runs AG.magic on it) */
      AG.save(Object.assign({ applied: o.apply ? Object.assign({}, AG.state.applied, { [o.apply]: true }) : AG.state.applied, done: Object.assign({}, AG.state.done, { [data.card]: true }) }, o.apply ? flash('apply:' + o.apply) : {}));
      return chat.say(o.reply, 500);
    }
    if (data.flow === 'start' && act === 'submit') {
      const r = data.route, v = data.fields.map((f) => f.value);
      const d = { title: v[0], sub: v[1], cols: [v[2]] };
      chat.widget(msg.id, { done: true });
      const drafts = Object.assign({}, AG.state.drafts, { [r]: [...(AG.state.drafts[r] || []), d] });
      /* the card leaves even if the name was changed: it's marked by the start it came from */
      AG.save(Object.assign({ drafts, done: Object.assign({}, AG.state.done, { [`start:${r}:${data.src}`]: true }) }, flash('draft:' + r + ':' + d.title)));
      if (opts.route() !== r) goTo(['dashboard', r]);
      chat.say(madeMsg(r, d), 700);
      setTimeout(() => { const n = document.querySelector('.is-new'); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
      return;
    }
    if (data.flow === 'add' && (act === 'submit' || act === 'decide')) {   // "Decide for me": the form as Newton filled it
      const r = data.route, v = data.fields.map((f) => f.value.trim()), mine = data.fields.some((f) => f.edited);
      if (!v[0]) return;
      const d = Object.assign({ title: v[0], sub: v[2], cols: r === 'store-offers' ? [v[1], 'Everyone', 'No limit'] : [v[1]] }, mine ? { by: 'you' } : {});   // typed over — made by you, no Newton mark
      chat.widget(msg.id, { done: true });
      AG.save(Object.assign({ drafts: Object.assign({}, AG.state.drafts, { [r]: [...(AG.state.drafts[r] || []), d] }) }, flash('draft:' + r + ':' + d.title)));
      if (opts.route() !== r) goTo(['dashboard', r]);
      setTimeout(() => { const n = document.querySelector('.is-new'); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
      chat.say({ tools: false, did: { title: `Added a draft to ${SECTION(r)}`, count: false, steps: [`${d.title}: ${d.sub}`, `Price: ${v[1]}, rounded by your price template`, 'Draft — goes live with your hub'] },
        text: `**${d.title}** is in **${SECTION(r)}** — ${d.sub}, **${v[1]}**.\n\nIt’s a draft: nothing goes live until your hub does.`,
        actions: [{ label: `Open in ${SECTION(r)}`, act: `go:${r}`, kind: 'tertiary', at: r }] }, 600);
      return;
    }
    if (data.flow === 'edit' && act === 'submit') {
      const it = AG.items.find((x) => x.id === data.item), keys = ['name', 'price', 'sub', 'sku'];
      const v = data.fields.map((f) => f.value.trim()), changed = keys.filter((k, i) => v[i] !== String(it[k] || ''));
      chat.widget(msg.id, { done: true });
      if (changed.length) AG.save(Object.assign({ edited: Object.assign({}, AG.state.edited, { [data.item]: true }),
        itemEdits: Object.assign({}, AG.state.itemEdits, { [data.item]: Object.assign({}, (AG.state.itemEdits || {})[data.item], ...changed.map((k) => ({ [k]: v[keys.indexOf(k)] }))) }) }, flash('item:' + data.item)));
      const LBL = { name: 'name', price: 'price', sub: 'what’s inside', sku: 'link to the game' };
      chat.say({ tools: false, text: changed.length ? `Saved **${v[0]}** — ${changed.map((k) => `${LBL[k]}: **${v[keys.indexOf(k)]}**`).join(', ')}. You changed it, so the Newton mark is gone.` : 'Nothing changed — it stays as it was.' }, 400);
      return;
    }
    if (data.type === 'stats' && act === 'open') return goTo(['dashboard', 'analytics-transactions']);

    /* the event */
    const flow = data.flow;
    /* each step: save the piece, show it in its section, go on. A reopened step (Change) only
       updates its piece and shows it — the flow doesn't start over, the event card follows. */
    const EV_STEP = { idea: [null, 'bundle'], bundle: [['dashboard', 'store-bundles'], 'rewards'], rewards: [['dashboard', 'engagement-daily-rewards'], 'banner'],
      banner: [['hub', 'home'], 'push'], push: [['dashboard', 'marketing-campaigns'], 'summary'] };
    if (EV_STEP[flow] && act === 'decide') return decideEvent(msg, data);
    if (EV_STEP[flow] && (act === 'create' || act === 'submit')) {
      const redo = data.redo, [to, next] = EV_STEP[flow];
      const v = flow === 'push' ? (([t, x, w, who]) => ({ title: t, text: x, when: w, who }))(data.fields.map((f) => f.value)) : data.options[data.picked];
      chat.widget(msg.id, { done: true, redo: false });
      if (flow === 'idea') setEv({ idea: v }); else put(flow, v);
      if (redo) { refreshPack(); return to && goTo(to); }
      if (flow === 'idea') return STEPS.bundle();
      return goTo(to, next);
    }
    if (flow === 'pack') {
      if (act === 'open') return goTo(data.rows[ctx.i].to);
      if (act === 'unblock') return task('verify');
      if (act === 'schedule') {
        /* the moment it's done (Daria, 27.09): pumpkins and candy burst out of the button, the card turns to "Scheduled" */
        const b = ctx.el && ctx.el.getBoundingClientRect();
        if (b) AG.confetti(b.left + b.width / 2, b.top + b.height / 2);
        setEv({ scheduled: true });
        chat.widget(msg.id, { scheduled: true });
        return chat.say({ tools: false, text: 'I’ll tell you how it goes after the first day.' }, 900);
      }
      /* a scheduled event can be taken back (Daria, 28.09): it goes back to drafts, Schedule is there again */
      if (act === 'unschedule') {
        setEv({ scheduled: false });
        chat.widget(msg.id, { scheduled: false });
        return chat.say({ tools: false, text: 'Unscheduled. **Everything stays as drafts** — schedule it again whenever you like.' }, 600);
      }
    }
    /* nothing else is wired: unwired buttons aren't shown in the first place (Daria, 26.09) */
  }

  /* ================= the panel ================= */
  /* Newton's width follows the work (Daria, 26.09): no task — the usual width; a task or the event under
     way — half the screen, because its result lands on the page next to it; the page has nothing to show
     yet — nearly all of it, back to half as soon as something lands. The left column folds on its own
     when Newton is this big (app.js). Getting smaller waits a beat, so the new row is seen first. */
  const TASK_FLOWS = ['idea', 'bundle', 'rewards', 'banner', 'push', 'draft', 'choice', 'start', 'add'];   // add: the new item lands on the page beside
  const evHere = () => { const e = ev(); return !!(e && e.thread === showing); };
  function taskActive() {
    if (building() && evHere()) return true;
    const msgs = chat ? chat.messages : [], last = msgs[msgs.length - 1];
    if (!last) return false;
    const asked = msgs.map((m) => m.task).lastIndexOf(true);
    if (asked > -1 && msgs.slice(asked + 1).every((m) => m.typing)) return true;              // a card was clicked, Newton is on it
    if (msgs.some((m) => m.widget && !m.widget.done && TASK_FLOWS.includes(m.widget.flow))) return true;
    return !!(last.widget && last.widget.type === 'pack' && !last.widget.scheduled);           // the event card, waiting to be scheduled
  }
  /* something just landed on the page: keep half the screen for a moment, so the new row is seen */
  const justLanded = () => { const f = AG.state.flash; return !!(f && Date.now() - f.at < 2400); };
  /* the way out of the whole-screen chat, without a back button: go to any section in the sidebar or press
     Esc — the page comes back and Newton moves to half beside it, the task goes on (Daria, 26.09) */
  let lookAtPage = false;
  let userMin = false;         // folded to the rail by hand ("<>") — stays folded until opened again or a card is clicked
  /* lost focus (Daria, 26.09): a task is open in the chat, but the person has clicked around the page a couple of
     times for something else — Newton steps back to the usual side panel so the section gets the room. The task
     stays where it is; a click anywhere in the chat brings the task's width back. */
  let away = false, awayClicks = 0;
  const AWAY_AFTER = 2;
  function width() {
    if (userMin) return 'minimal';
    if (page === 'hub') return 'moderate';           // in Hub the width stays put: the canvas is the work (Daria, 26.09)
    const w = baseWidth();
    if (w === 'moderate') { lookAtPage = false; away = false; awayClicks = 0; }   // the task is over: the next one starts fresh
    if (away) return 'moderate';
    return lookAtPage && w === 'full' ? 'half' : w;
  }
  function baseWidth() {
    const e = ev();
    if (building() && evHere() && !(e && e.bundle)) return 'full';   // the event starts on the whole screen: nothing on the page matters yet
    if (taskActive()) return opts.kind() === 'empty' ? 'full' : 'half';
    return justLanded() ? 'half' : 'moderate';
  }
  let shrinkT = null;
  const RANK = { minimal: 0, moderate: 1, wide: 2, half: 3, 'two-thirds': 4, full: 5 };
  function sync(now) {
    if (!chat) return;
    const to = width(), cur = chat.el.dataset.nw || chat.opts.state;   // what's on screen, whoever set it
    clearTimeout(shrinkT);
    if (to === cur) { if (justLanded()) setTimeout(() => sync(), 2500); return; }   // same width: don't redraw the conversation
    const go = () => chat.width(to, { rail: rail(), back: 'moderate' });
    /* only going back to the usual width waits a beat; making room (or full → half) is immediate */
    if (now || to !== 'moderate' || (RANK[cur] || 0) <= RANK.moderate) go(); else shrinkT = setTimeout(go, 900);
    if (justLanded()) setTimeout(() => sync(), 2500);
  }
  const rail = () => (page === 'hub' ? 'Newton' : AG.navLabel('dashboard', opts.route()) || 'Newton');
  const ctxKey = () => (page === 'hub' ? 'hub' : 'dashboard:' + opts.route());

  /* ================= a conversation per page (Daria, 26.09) =================
     store.threads[key] — the conversation of a page ('dashboard:store-bundles', 'hub'), with .at — the page it
     was last seen on. store.carry — a conversation Newton brought along to another page mid-task: it stays on
     screen until you go somewhere yourself (moved: Newton is taking you there right now). */
  let store = { threads: {}, carry: null };
  let showing = null;          // whose conversation is on screen
  let ctxFor = null;           // the page whose messages (signals) were last pushed
  let handled = new Set();     // signals already acted on (dismissed, extended…) — they don't come back
  const saveStore = () => keep(Object.assign(store, { handled: [...handled] }));
  /* whose conversation this page shows: its own, or the one Newton carried here */
  function pickThread() {
    const key = ctxKey(), c = store.carry;
    if (c && store.threads[c.key] && (c.moved || c.at === key)) { store.carry = { key: c.key, at: key, moved: false }; return c.key; }
    store.carry = null;
    return key;
  }
  /* the empty chat's one line changes on every visit, so it doesn't go stale (Daria, 28.09).
     Not a question back (Daria, 29.09: "How can I help?" says nothing — Newton always offers something to do):
     each line names a thing that works on this page right now */
  const HERO = {
    hub: ['Click any block on the page, then tell me what to change.', 'Want a new look? Open Styles below, or roll the dice.', 'Roll the dice below — I’ll try another look for this page.'],
    dashboard: ['Ask me anything about your game — sales, players, what to sell next.', 'Tell me what to make — an offer, a bundle, an event — and I’ll draft it.'] };
  let heroN = Math.floor(Math.random() * 5), heroLine = (HERO[page] || HERO.dashboard)[0];
  const nextHero = () => { const l = HERO[page] || HERO.dashboard; heroN = (heroN + 1) % l.length; heroLine = l[heroN]; };
  function enter(force) {
    if (!chat) return;
    const key = ctxKey(), want = pickThread();
    if (want !== showing) { showing = want; chat.load((store.threads[want] || {}).messages || []); }
    /* the page's own conversation gets the page's messages, fresh each time you open it */
    if (want === key && (ctxFor !== key || force)) {
      /* a real visit (you came to this page) vs. a redraw (something changed while you're here — mid-task, say):
         only a visit starts clean and gets Newton's greeting; a redraw leaves your task open and the greeting where it is */
      const visit = ctxFor !== key || force === 'visit';
      if (visit) nextHero();
      ctxFor = key;
      const redrawn = (m) => m.ctx && (visit || !String(m.sid || '').startsWith('hi:'));
      chat.messages.filter(redrawn).forEach((m) => { if (m.used && (m.actions || (m.widget && ['offer', 'signal'].includes(m.widget.type)))) handled.add(m.sid); });   // answered — it doesn't come back
      chat.messages.filter(redrawn).map((m) => m.id).forEach((id) => chat.remove(id));
      if (visit) {
        /* a new visit starts clean (Daria, 27.09): what's done here is put away — the unfinished stays in its strip */
        const openIds = new Set(tasksIn(key, chat.messages).filter((t) => t.open).flatMap((t) => t.ids));
        /* ...and nothing is left open on arrival — every unfinished task waits in its strip, unless you came here by one */
        if (store.resume && openIds.size && tasksIn(key, chat.messages).some((t) => t.id === store.resume)) { actives()[key] = store.resume; lift(store.resume); }
        else delete actives()[key];
        store.resume = null;
        chat.messages.forEach((m) => { if (!m.archived && !openIds.has(m.id)) chat.update(m.id, { archived: true }); });
      }
      here().filter((m) => m && !handled.has(m.sid)).forEach((m) => chat.push(Object.assign({ from: 'newton', tools: false, ctx: key }, m)));
      if (visit && page === 'dashboard') greet(key);
    }
    if (want !== key) ctxFor = null;
    store.threads[want] = { messages: chat.messages.filter((m) => !m.typing), at: key };
    saveStore();
    sync(); syncSugg(); syncAlerts(); syncWork(); syncPack(); freshWords();
  }
  /* Continue on the pin: back to the page where that work was left, with its conversation */
  function continueAt(key) {
    const at = (store.threads[key] && store.threads[key].at) || key;
    store.carry = { key, moved: true }; saveStore();
    const hub = at === 'hub', r = hub ? '' : at.split(':')[1];
    if ((hub ? 'hub' : 'dashboard') !== page) { AG.go(hub ? 'Hub.html' : `Dashboard.html#${r}`); return; }
    if (!hub && opts.route() !== r) { location.hash = r; return; }
    enter();
  }

  /* ================= unfinished work: a stack of strips on top of the chat (Daria, 27.09) =================
     A task = what you asked from a card (a "you" message with taskId) and everything after it until you say something
     else. Unfinished: its block isn't done yet (the event: not built yet). Every unfinished task is a strip on top — here
     and on any page; only the one you work on is open in the conversation, the others are put away into their strips.
     A strip opens its task (on its own page, if it's elsewhere); its × — or × in the block's head — cancels it. */
  const FLOWS = ['idea', 'bundle', 'rewards', 'banner', 'push'];
  const OPEN_FLOWS = ['draft', 'choice', 'start', 'verify', 'connect', 'add', 'edit'];
  const evDone = (e) => FLOWS.filter((k) => e[k]).length;   // five steps, the idea is the first
  const actives = () => (store.active = store.active || {});   // per conversation: the task open in it (the id of its "you" message); kept with the conversations
  function tasksIn(key, msgs) {
    const out = [];
    msgs.forEach((m, i) => {
      if (m.from !== 'you' || !m.taskId) return;
      const end = msgs.findIndex((x, k) => k > i && x.from === 'you');
      const range = msgs.slice(i, end < 0 ? msgs.length : end).filter((x) => !x.ctx);
      const e = ev();
      const open = m.taskId === 'halloween' ? !!(e && !e.scheduled && e.thread === key)   // built but not scheduled: one click is still left
        : range.some((x) => x.widget && !x.widget.done && OPEN_FLOWS.includes(x.widget.flow));
      const text = m.taskId === 'halloween' ? (e && e.built ? 'Halloween event is ready' : 'Creating Halloween event') : m.text;
      out.push({ key, id: m.id, taskId: m.taskId, text, ids: range.map((x) => x.id), open });
    });
    return out;
  }
  const threadMsgs = (k) => (k === showing && chat ? chat.messages : ((store.threads[k] || {}).messages || []));
  const whereIs = (k) => (k === 'hub' ? 'Hub' : AG.navLabel('dashboard', k.split(':')[1]) || 'Home');
  /* put away every unfinished task here but the one you work on */
  function fold() {
    const list = tasksIn(showing, chat.messages).filter((t) => t.open);
    const act = list.find((t) => t.id === actives()[showing]) ? actives()[showing] : null;
    const hide = new Set(list.filter((t) => t.id !== act).flatMap((t) => t.ids));
    chat.messages.forEach((m) => { if (!!m.folded !== hide.has(m.id)) chat.update(m.id, { folded: hide.has(m.id) }); });
  }
  function strips() {
    const out = [];
    /* a task whose card is right there on the page gets no strip here (Daria, 28.09: the same thing twice, left and right) —
       the card is the way back to it */
    const onPage = new Set(page === 'dashboard' ? cards(opts.route()).map((c) => c.id) : []);
    Object.keys(Object.assign({}, store.threads, { [showing]: 1 })).forEach((k) => {
      tasksIn(k, threadMsgs(k)).filter((t) => t.open && !(k === showing && t.id === actives()[showing]) && !(store.muted || {})[t.id] && !(k === showing && onPage.has(t.taskId))).forEach((t) => {
        const e = ev(), isEv = t.taskId === 'halloween';
        const steps = isEv ? { done: evDone(e), of: 5 } : t.taskId === 'verify' ? { done: Math.min(AG.state.verify.step, AG.VERIFY_TOTAL), of: AG.VERIFY_TOTAL }
          : t.taskId === 'connect' ? { done: Math.min(AG.state.connect, AG.CONNECT_TOTAL), of: AG.CONNECT_TOTAL } : null;
        const where = k === showing ? '' : whereIs(k);
        /* the card of the page (Daria, 29.09): its kind, the task, one line — what's left or where it waits; the steps go to the ring */
        const sub = isEv && e.built ? 'One click to schedule' : where ? `Waiting on ${where}` : 'Pick up where you left off';
        out.push(Object.assign({ text: t.text, kind: typeOf(t.taskId), sub, go: k, id: t.id, ev: isEv }, steps || {}));
      });
    });
    return out.sort((a, b) => (b.ev - a.ev) || (b.id - a.id));   // the event first, then the newest
  }
  function syncWork() { if (!chat) return; fold(); chat.setPins(strips()); }
  /* a strip: here — open that task (and put the one you were on away); elsewhere — go to its page, open it there */
  /* a task picked up again moves to the end of the conversation (Daria, 27.09): things happened after it, and the chat
     reads in the order you did things — so it comes back to "now", not to where it was left in the past */
  function lift(id) {
    const t = tasksIn(showing, chat.messages).find((x) => x.id === id); if (!t) return;
    const mine = new Set(t.ids), moved = chat.messages.filter((m) => mine.has(m.id));
    if (!moved.length || chat.messages.slice(-moved.length).every((m) => mine.has(m.id))) return;   // already the last thing
    chat.load(chat.messages.filter((m) => !mine.has(m.id)).concat(moved.map((m) => Object.assign(m, { archived: false }))));
    store.threads[showing] = { messages: chat.messages.filter((m) => !m.typing), at: ctxKey() };
  }
  function onPin(c, p) {
    if (!p) return;
    actives()[p.go] = p.id; store.resume = p.id; saveStore();
    if (p.go !== showing) return continueAt(p.go);
    store.resume = null;
    lift(p.id); saveStore();
    syncWork();
    setTimeout(() => chat.scroll(), 60);
  }
  /* cancel a task: its messages go, the card comes back on its page; the event also takes back what it put in place */
  function cancelTask(k, id) {
    const t = tasksIn(k, threadMsgs(k)).find((x) => x.id === id); if (!t) return;
    if (t.taskId === 'halloween') AG.save({ event: null });
    if (k === showing) t.ids.forEach((mid) => chat.remove(mid));
    else if (store.threads[k]) store.threads[k].messages = store.threads[k].messages.filter((m) => !t.ids.includes(m.id));
    if (actives()[k] === id) delete actives()[k];
    saveStore(); syncWork(); sync();
  }
  /* the strip is a reminder (Daria, 27.09): × only hides the reminder — the task stays, its card is on its page and Home's
     summary lists it; to drop the task itself you open it and press Cancel there */
  const onPinClose = (c, p) => { if (!p) return; store.muted = Object.assign({}, store.muted, { [p.id]: true }); saveStore(); syncWork(); };
  const allOpen = () => Object.keys(Object.assign({}, store.threads, { [showing]: 1 })).flatMap((k) => tasksIn(k, threadMsgs(k)).filter((t) => t.open));
  /* the × in a block's head: the task this block belongs to */
  AG.chat.canCancel = (d) => OPEN_FLOWS.includes(d.flow) || FLOWS.includes(d.flow);
  /* a way to a section ("Open in Bundles") isn't shown while you're in that section (Daria, 27.09): it would lead nowhere.
     It comes back when you look at the conversation from elsewhere. */
  AG.chat.isHere = (route) => !!route && page === 'dashboard' && opts.route() === route;
  function cancelFrom(msg) {
    const t = tasksIn(showing, chat.messages).find((x) => x.ids.includes(msg.id));
    if (t) cancelTask(showing, t.id);
    else if (FLOWS.includes((msg.widget || {}).flow)) { AG.save({ event: null }); chat.remove(msg.id); syncWork(); }   // an event started by typing
  }

  /* the prototype's controls (avatar menu): start this page over — its conversation, the cards done from it and the drafts
     made on it (Hub: the look Newton made) — or the Halloween event: its conversation and the four pieces it put in place */
  const cardIds = (route) => (STARTS[route] ? STARTS[route].list.map((d, i) => `start:${route}:${i}`)
    : WAIT[route] ? WAIT[route].map((k) => LAUNCH_CARD[k]).concat(route.startsWith('analytics') ? 'welcome-gift' : 'creator-code')
    : PAGE_CARDS[route] ? PAGE_CARDS[route]() : []);
  function forget(key) { delete store.threads[key]; if (store.carry && store.carry.key === key) store.carry = null; saveStore(); }
  function restartPage() {
    forget(ctxKey());
    if (page === 'hub') { AG.save({ hub: null }); return; }
    const r = opts.route(), done = Object.assign({}, AG.state.done), drafts = Object.assign({}, AG.state.drafts);
    cardIds(r).forEach((id) => { delete done[id]; });
    delete drafts[r];
    AG.save(Object.assign({ done, drafts }, r === 'home' ? { undone: {} } : {}));
  }
  /* the review came back (Daria, 28.09: it can't pass unnoticed): Newton says it once, wherever you are, with the way on */
  function approvedNews() {
    const v = AG.state.verify;
    if (!chat || v.status !== 'approved' || !v.approvedAt || v.told) return;
    AG.save({ verify: Object.assign({}, v, { told: true }) });
    const can = AG.canPublish() && !AG.state.published;
    chat.newton({ tools: false, text: `**Your company is verified.** Payments and publishing are on${can ? ' — your hub can go live now.' : AG.state.published ? '.' : ' — connect the game, and your hub can go live.'}`,
      actions: can ? [{ label: 'Publish', act: 'publish', kind: 'primary' }] : [] });
  }
  function restartEvent() { const e = ev(); if (!e) return; if (e.thread) forget(e.thread); AG.save({ event: null }); }
  function fresh(key) { const f = AG.state.flash; return !!(f && f.key === key && Date.now() - f.at < 6000); }

  function conversation() {
    const h = AG.homeState();
    const saved = load(), proto = AG.state.protoSwitch || 0;
    if (saved && saved.threads && (saved.proto || 0) === proto) {   // not switched from the prototype menu since (the same state, or moved on by a real step) — a switch, even to the same state, starts over (Daria, 28.09)
      saved.stamp = h;
      handled = new Set(saved.handled || []);
      Object.values(saved.threads).forEach((t) => {
        (t.messages || []).filter((m) => m.ctx && m.used && (m.actions || (m.widget && ['offer', 'signal'].includes(m.widget.type)))).forEach((m) => handled.add(m.sid));
        t.messages = (t.messages || []).filter((m) => !m.ctx);   // a page's signals are pushed fresh when it opens
      });
      return saved;
    }
    /* Home state switched (prototype control), first visit, or the old one-conversation format: Newton starts over */
    const s0 = { stamp: h, proto, threads: {}, carry: null, handled: [] };
    keep(s0);
    if (saved && ev()) AG.save({ event: null });
    return s0;
  }

  function mount(o) {
    opts = Object.assign({ route: () => '', hubPage: () => 'home', kind: () => 'list', onPage: () => {}, onLook: () => {} }, o);
    page = o.page;
    nextHero();   // the empty chat's line is this page's own from the first draw
    store = conversation();
    showing = pickThread();
    const all = Object.values(store.threads).flatMap((t) => t.messages || []);
    chat = AG.chat.mount(document.getElementById('nw-chat'), {
      state: width(), rail: rail(), back: 'moderate',
      messages: (store.threads[showing] || {}).messages || [], seq: Math.max(0, ...all.map((m) => Number(m.id) || 0)),
      answers: ANSWERS, fallback: FALLBACK, wired: (q) => wired(q),
      onChange: (list) => { store.threads[showing] = { messages: list, at: ctxKey() }; saveStore(); setTimeout(() => { if (chat) { syncWork(); sync(); syncSugg(); } }, 0); },
      onPin, onPinClose,
      hero: { title: () => heroLine },   // like Sidekick, Fin, ChatGPT: one short line; the ready asks below do the rest — a different one on each visit
      hints: () => hintsHere(),             // the empty input shows this page's examples, one after another
      onAction
    });
    enter();

    /* came here in the middle of the event: Newton goes on from where he left (in the event's conversation) */
    const e = ev();
    if (e && e.pending && evHere()) { const next = e.pending; setEv({ pending: null }); setTimeout(() => run(next), PACE.step); }

    setTimeout(approvedNews, 2600);   // it came back while you were somewhere without Newton: he says it after his greeting
    document.addEventListener('ag:change', () => {
      const h = AG.homeState(), c = load();
      if (c && c.stamp !== h && (c.proto || 0) === (AG.state.protoSwitch || 0)) {   // moved on by a real step (Publish, the first purchase): keep everything, greet anew
        store.stamp = h; saveStore(); enter('visit');
        return;
      }
      if (c && (c.stamp !== h || (c.proto || 0) !== (AG.state.protoSwitch || 0))) {   // a state picked in the prototype menu (even the same one): Newton starts over
        handled = new Set(); store = { stamp: h, proto: AG.state.protoSwitch || 0, threads: {}, carry: null, handled: [] };   // stamp first: the saves below fire ag:change again
        keep(store);
        if (ev()) AG.save({ event: null });
        showing = null; ctxFor = null; enter(true);
        return;
      }
      /* the launch steps and the event card follow what just happened (verified, connected, published) */
      approvedNews();
      syncWork(); sync(); syncSugg(); syncAlerts();   // a draft landed on an empty page: from nearly all the screen back to half; it isn't blank any more
      syncPack(); syncSummary();
    });
    window.addEventListener('hashchange', () => { enter(); chat.messages.filter((m) => (m.actions || []).some((a) => a.at) || (m.widget && m.widget.doneLink)).forEach((m) => chat.update(m.id, {})); });   // the ways to sections follow where you are
    /* every mechanic answers every other one (Daria, 26.09):
       sidebar opened by hand while Newton is full → the page comes back, Newton goes to half;
       sidebar folded by hand while Newton made room for the page → Newton takes the screen again;
       Newton folded to the rail ("<>") or opened from it → the rest follows from its new width */
    document.addEventListener('ag:side', (ev2) => {
      const nw = chat.el.dataset.nw;
      if (!ev2.detail.collapsed && (nw === 'full' || nw === 'two-thirds')) { lookAtPage = true; sync(true); }
      else if (ev2.detail.collapsed && lookAtPage && baseWidth() === 'full') { lookAtPage = false; sync(true); }
    });
    chat.el.addEventListener('click', (ev2) => {
      if (ev2.target.closest('[data-nw-collapse]')) { userMin = true; setTimeout(() => sync(true), 0); }
      else if (ev2.target.closest('[data-nw-expand]')) { userMin = false; setTimeout(() => sync(true), 0); }
    });
    document.addEventListener('click', (ev2) => {
      const t = ev2.target;
      if (t.closest('#nw-chat')) { if (away) { away = false; awayClicks = 0; sync(true); } return; }   // back to the task
      if (!taskActive() || t.closest('[data-task], .app__header, .ag-backdrop, .drawer-bg')) return;   // a card starts its own task
      if (!t.closest('.app__main, .app__side, .panel--left, .panel--right, .hub-center')) return;
      if (++awayClicks >= AWAY_AFTER && !away) { away = true; sync(true); }
    });
    const side = document.querySelector('.app__side, .panel--left');
    if (side) side.addEventListener('click', (e) => { if (e.target.closest('a, button')) { lookAtPage = true; sync(true); } });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || chat.opts.state !== 'full' || document.querySelector('.ag-backdrop:not([hidden]), .drawer-bg:not([hidden])')) return;
      lookAtPage = true; sync(true);
    });
    setTimeout(() => syncWork(), 300);
    return chat;
  }

  /* the page changed what Newton says about it (images drawn, items linked): its messages are redrawn */
  const refresh = (v) => enter(v === 'visit' ? 'visit' : true);   // 'visit': another page of the hub — like coming to a page, what's finished is put away
  /* published (Daria, 27.09 — not a green toast that seems to wait for something else): Newton says it in the conversation,
     where it is and who sees it, and the next thing to do — look at it live */
  const LIVE_URL = 'Hub.html?embed=desktop&page=home&full=1';
  const liveMsg = () => ({ tools: false, text: '**Your hub is live** at pixelraiders.aghanim.store — players can see it and buy now.', actions: [{ label: 'Open hub', act: 'open-live', kind: 'primary' }] });
  const published = () => { if (chat) chat.say(liveMsg(), 400); };
  return { published, mount, fresh, cards, task, refresh, restartPage, restartEvent, STARTS, get event() { return ev(); }, DATES };
})();
