/* Newton chat engine — one conversation component for every flow.
 *
 * The split panel (mountChat in app.js) decides how wide Newton is; this file decides what
 * happens inside: messages, the widgets he answers with, ready questions and the input dock.
 * A flow only describes its script — the engine draws it and keeps the history.
 *
 *   const chat = AG.chat.mount(el, {
 *     state: 'moderate',                       // panel width, same states as mountChat
 *     hero: { title, lead },                   // shown while the conversation is empty
 *     messages: [...],                         // what is already said
 *     suggestions: ['…'],                      // ready questions above the input
 *     answers: [{ match: ['halloween'], reply: {...} }],   // canned replies for the prototype
 *     onSend(text, chat) {},                   // or take it over completely
 *     onAction(act, ctx) {}                    // clicks inside widgets the engine doesn't own
 *   });
 *   chat.you('…'); chat.thinking(); chat.newton({ text, widget, chips });
 *
 * A message: { from: 'you' | 'newton', text, widget: { type, ... }, chips: [], tools: false,
 *              tag: ['Calendar', 'blue-tertiary'], actions: [{ label, act | q, kind: 'primary' | 'outline' | 'tertiary' }] }
 * tag + actions turn a message into a signal: Newton's suggestions live in the chat, not on the page
 * (Daria, 26.09). An action with q asks that question; anything else goes to onAction(act, { kind: 'msg' }).
 * onChange(messages) fires after every change, so a page can keep the conversation between pages.
 * A message someone clicked into gets used: true — a page can drop the untouched ones when context changes.
 * pins: [{ text, note, done, of }] — unfinished work, a stack of strips at the top of the panel (a ring when it has steps).
 *      Click → onPin(chat, pin); its × hides the reminder → onPinClose(chat, pin). chat.setPins(list); chat.setPin(pin) — one or none.
 * A message with folded: true isn't drawn (a task put away into its strip). A step block shows Cancel (drop the task) when
 *      AG.chat.canCancel(widget) says so; the click goes to onAction('cancel').
 * alerts: [{ title, note, action: { label, act } }] — problems at the top of the panel with the pin, not part of the conversation;
 *      the action is Newton fixing it on the spot, so it's the dark button with the sheen.
 *      (Hub: items not linked, no images). chat.setAlerts(list); a click goes to onAction(act, { kind: 'alert' }).
 * offer widget: { type: 'offer', title, text, cta, q, alt, altNote, keep } — Newton proposes to make something (Daria, 26.09):
 *      keep: once answered the block goes quiet but its button stays, as an outline — you can go there again (a way back).
 *      The answer is Newton's work — the dark button with the sheen. quiet: an outline instead — a gentle proposal that shouldn't pull focus (Daria, 27.09).
 *      the same blue block as a step of the event. cta asks q as your answer; alt ("Not now") closes it quietly.
 *      Plain conversation stays text; a proposal to generate is wrapped in a block.
 * options widget: rec — index of the recommended option (default 0, false — none); decide — label of the
 *      "Decide for me" button, its click goes to onAction('decide').
 * stream: true on a message — its text types itself in, word by word, then its widget comes in (a new message only;
 *      drawn again later it's just there).
 * hints: [...] or () => [...] — what the empty input shows, one after another (Daria, 27.09: never "Ask Newton…";
 *      examples of what you can write here change inside the field). chat.hint(text) holds one line instead
 *      (e.g. "Write it your way…"), chat.hint(null) lets them change again.
 */
AG.chat = (() => {
  const { $, $$, icon, nwIcon, mountChat, toast } = AG;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* plain text with **bold** and blank lines — enough for a prototype, no markdown engine */
  /* Newton's text reads at a glance (Daria, 27.09): **bold** for what matters and the numbers; lines starting "- " are a list;
     ↑12% / ↓3% — a change, green up and red down. Paragraphs split by an empty line. */
  const inline = (p) => p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/↑\s?([$\d][\d,.$%+]*%?)/g, '<span class="chat__up">↑ $1</span>').replace(/↓\s?([$\d][\d,.$%+]*%?)/g, '<span class="chat__down">↓ $1</span>');
  const rich = (s) => esc(s).split(/\n{2,}/).map((p) => {
    const lines = p.split('\n'), out = []; let list = [];
    const flush = () => { if (list.length > 1) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`); else if (list.length) out.push(`<p>${inline(list[0])}</p>`); list = []; };   // one point is a sentence, not a list
    lines.forEach((l) => { if (/^[-•]\s/.test(l)) list.push(l.replace(/^[-•]\s/, '')); else { flush(); if (l.trim()) out.push(`<p>${inline(l)}</p>`); } });
    flush();
    return out.length > 1 ? `<div class="chat__blk">${out.join('')}</div>` : out.join('');   // a heading and its list stay together; air goes between blocks
  }).join('');
  /* buttons in the chat are white with a line, not brand blue: the panel sits next to a page that
     already has its one main action (Daria, 26.09 — accents) */
  /* the page's card, compact, for the chat (Daria, 28.09: a problem or a tip in the chat is the same thing as the card on the
     page — draw it the same). The type badge, the title with the arrow beside it, one line, the number with its bar.
     The whole card is the button. */
  const ctaCard = (d, attrs = '') => `<article class="cta cta--lv${d.lv || 3} cta--chat" tabindex="0" role="button" aria-label="${esc(d.title)}${d.cta ? `. ${esc(d.cta)}` : ''}" ${attrs}>
      <div class="cta__head">${d.kind ? `<span class="cta__type">${icon(d.lv === 1 ? 'bolt' : AG.TYPE_ICON[d.kind] || 'bolt', 'cta__bolt')}${esc(d.kind)}</span>` : ''}
        <div class="cta__trow"><b class="cta__title">${esc(d.title).replace(/(\S+)$/, `<span class="cta__end">$1${icon('arrow', 'cta__arrow')}</span>`)}</b></div></div>
      ${d.sub ? `<p class="cta__sub">${esc(d.sub).replace(/\.$/, '')}</p>` : ''}
      ${d.sig ? `<span class="cta__num">${d.sig.bar != null ? `<span class="ag-ring cta__ring" style="--v:${d.sig.bar}" aria-hidden="true"></span>` : ''}<b>${esc(d.sig.v)}</b>${d.sig.u ? `<span>${esc(d.sig.u)}</span>` : ''}</span>` : ''}
    </article>`;
  const btn = (t, act, cls = 'ag-btn ag-btn--outline ag-btn--sm', extra = '') => `<button class="${cls}" data-cw="${act}" ${extra}>${esc(t)}</button>`;
  /* a block that asks you something — a step with choices, a form, the event card waiting for Schedule — is light blue,
     and its action is a primary button again (Daria, 26.09 — replaces "white buttons in the chat" for these blocks).
     Once answered, the block goes quiet: no colour, no buttons. */
  const PRI = 'ag-btn ag-btn--primary ag-btn--sm';
  /* buttons by meaning (Daria, 27.09): the goal of the block — dark primary; the goal that sets Newton working on — the same,
     with a slow sheen (ag-btn--ai); a side action — outline; going somewhere, cancelling — tertiary.
     A block is Newton's work when it says ai: true, or when the page says so (AG.chat.aiCta(d), e.g. the event's first step). */
  const AI = PRI + ' ag-btn--ai';
  const ACT = { ai: 'ag-btn--primary ag-btn--ai', primary: 'ag-btn--primary', tertiary: 'ag-btn--tertiary' };   // a message's buttons: actions[].kind
  const goal = (d) => (d.ai || (AG.chat.aiCta && AG.chat.aiCta(d)) ? AI : PRI);

  /* ================= widgets =================
     Every widget gets its own data object and can change it in place: the engine re-renders
     just that message. Built-in behaviour (pick an option, lock a variant, reroll) lives here;
     anything else goes out to onAction. */
  /* the head of a step block: "2 of 4" and what this step is, in one line */
  /* a step you've passed can be reopened: "Change" sits where the counter was. Change and Cancel are the same quiet kit button,
     with their icons (pencil, cross) — no blue words (Daria, 27.09) */
  const stepOf = (d) => (AG.chat.stepLabel && AG.chat.stepLabel(d)) || d.step;   // the page may count the steps its own way (the event: 1 of 5)
  const canCancel = (d) => !d.done && AG.chat.canCancel && AG.chat.canCancel(d);   // an open task can be dropped from its block (Daria, 27.09)
  /* one head for every step block (Daria, 28.09: "2 of 3" hung loose and Cancel looked off, a fix for all screens): the step
     number is a small line above the title, like the type badge above a card's title; the block's own actions — Change,
     Cancel — are quiet icons in its top-right corner, the word in a tooltip. They never meet the block's buttons below. */
  const cornerBtn = (ic, act, label) => `<button class="ag-btn ag-btn--tertiary ag-btn--sm ag-btn--icon cw-step__ic tip-up" data-cw="${act}" aria-label="${label}" data-hint="${label}">${icon(ic)}</button>`;
  const stepHead = (d) => {
    const n = !d.done && stepOf(d), acts = (d.done && d.editable ? cornerBtn('pen', 'edit', 'Change') : '') + (canCancel(d) ? cornerBtn('x', 'cancel', 'Cancel') : '');
    return d.title || n ? `<div class="cw-step__head"><div class="cw-step__t"><b>${esc(d.title || '')}</b>${n ? `<span class="cw-step__n">Step ${esc(n)}</span>` : ''}</div>${acts ? `<div class="cw-step__acts">${acts}</div>` : ''}</div>` : '';
  };
  /* Recommended (Daria, 26.09): among several options Newton marks the one he'd take, so the step is easy.
     Two or three options — one mark; more than seven — two or three. In a step it's the option he pre-picks;
     after a reroll, the first of the new set. d.rec: its index, false — no mark. */
  const recOf = (d) => (d.rec === false ? -1 : d.rec == null ? 0 : d.rec);
  const REC = `<span class="cw-rec">${nwIcon('Newton recommends this one')}Recommended</span>`;
  /* an option's picture: markup, or { k, d } — what to draw, drawn now by the page's hook (AG.chat.art: the hub's look) */
  const artOf = (a, o) => {
    if (!a) return '';
    /* a picture saved as markup before 27.09: the page may know the option and draw it again in today's look */
    if (typeof a === 'string') { const again = AG.chat.legacyArt && AG.chat.legacyArt(o); return again ? AG.chat.art(again) : a; }
    return AG.chat.art ? AG.chat.art(a) : '';
  };
  /* "Decide for me" (Daria, 26.09): for people who don't want to click through — Newton takes what he
     recommends, here and in the steps after, and the result comes out ready */
  /* a way to where you already are isn't drawn (the page says so: AG.chat.isHere) */
  const here = (route) => !!(route && AG.chat.isHere && AG.chat.isHere(route));
  const visActs = (m) => (m.actions || []).filter((a) => !here(a.at));
  const decideBtn = (label) => `<button class="ag-btn ag-btn--primary ag-btn--ai ag-btn--sm cw-decide" data-cw="decide">${esc(label)}${icon('spark')}</button>`;   // every Decide looks the same: the Newton button

  const widgets = {

    /* Newton is doing it right now: generation, import, a check that takes time */
    working(d) {
      const pct = Math.max(0, Math.min(100, d.pct || 0));
      const done = d.done || pct >= 100;
      /* with steps (Daria, 28.09): the onboarding's build list — grey rings, a spinning arc, a grey tick, a dashed path; one plain
         heading, no pink caps, no percent, no bar (the steps are the progress). A step's result follows its name, quieter. */
      if (d.steps) {
        const at = d.at || 0;
        return `<div class="cw cw--working cw--steps${done ? ' is-done' : ''}${d.ai ? ' cw--ai' : ''}">
        <div class="cw__head"><b>${esc(done && d.doneKicker ? d.doneKicker : d.kicker || 'Working')}</b></div>
        <div class="cw__body"><div class="ob-list">${d.steps.map((s, i) => {
          const st = done || i < at ? 'done' : i === at && !d.stopped ? 'run' : 'wait', [name, res] = String(s).split(' — ');   // stopped: nothing spins
          /* the name only: the tick says it's done (Daria, 28.09); a stopped plan says what's left for you */
          return `<div class="ob-row is-${st}"><span class="ob-row__st"><span class="ob-row__spin"></span>${icon('tick')}</span><span class="ob-row__l">${esc(name)}${d.stopped && res && i >= at ? `<small class="ob-row__res"> · ${esc(res)}</small>` : ''}</span></div>`;
        }).join('')}</div></div>
      </div>`;
      }
      return `<div class="cw cw--working${done ? ' is-done' : ''}${d.ai ? ' cw--ai' : ''}">
  <!-- ai: Newton doing what a Decide button asked — dressed like that button (Daria, 28.09) -->
        <div class="cw__head"><span class="cw__kicker">${nwIcon()}${esc(d.kicker || (done ? 'Done' : 'Working'))}</span><span class="ag-spacer"></span><span class="cw-work__pct">${pct}%</span></div>
        <div class="cw__body">
          <div><b class="text-ui" style="color:var(--color-text-primary)">${esc(d.title || '')}</b>${d.note ? `<div class="cw__sub">${esc(d.note)}</div>` : ''}</div>
          <div class="ag-progress"><span style="width:${pct}%"></span></div>
          ${d.step && (!d.steps || done) ? `<div class="cw-work__step">${done ? icon('check') : '<span class="ag-spinner"></span>'}${esc(d.step)}</div>` : ''}
          ${d.steps ? `<div class="cw-work__list">${d.steps.map((s, i) => {
            const st = i < (d.at || 0) ? 'is-done' : i === (d.at || 0) && !done ? 'is-run' : done ? 'is-done' : '';
            return `<div class="gen-row ${st}"><span class="gen-row__st">${st === 'is-run' ? '<span class="ag-spinner"></span>' : st === 'is-done' ? icon('check') : '<span class="dot"></span>'}</span>${esc(s)}</div>`;
          }).join('')}</div>` : ''}
        </div>
        ${d.cancel && !done ? `<div class="cw__foot">${btn('Stop', 'cancel', 'ag-btn ag-btn--tertiary ag-btn--sm')}<span class="ag-hint">Nothing is published while I work.</span></div>` : ''}
        ${done && d.cta ? `<div class="cw__foot">${btn(d.cta, 'done')}</div>` : ''}
      </div>`;
    },

    /* the assisted form: what Newton can fill he fills himself and marks it (handoff 6.2, rule 3) */
    fields(d) {
      /* a field Newton set that isn't editable in the prototype yet: it looks like the real control — a date range, a
         dropdown — with its icon, and says so on hover (x.kind: 'range' | 'select') */
      const fake = (x, i) => `<div class="ag-input cw-fake tip-up" id="cwf-${d._id}-${i}" data-proto-tip="Not in this prototype"><span>${esc(x.value || x.sample || '')}</span>${icon(x.kind === 'range' ? 'calendar' : 'chev')}</div>`;
      const f = (x, i) => `<div class="ag-field"><label class="ag-label" for="cwf-${d._id}-${i}">${esc(x.label)}</label>
        <div class="nf">${x.kind && !d.done ? fake(x, i) : `<input class="ag-input" id="cwf-${d._id}-${i}" data-cw="field" data-i="${i}" value="${esc(x.value || x.sample || '')}" placeholder="${esc(x.ph || '')}"${d.done ? ' disabled' : ''}>`}</div>
        ${x.hint ? `<span class="ag-hint">${esc(x.hint)}</span>` : ''}</div>`;
      const rows = [];
      for (let i = 0; i < d.fields.length; i++) {
        const x = d.fields[i];
        if (x.half && d.fields[i + 1] && d.fields[i + 1].half) { rows.push(`<div class="cw-fields__row">${f(x, i)}${f(d.fields[i + 1], i + 1)}</div>`); i++; }
        else rows.push(f(x, i));
      }
      /* one block: the step, the form, one action. Done — the same block, quiet, nothing to press.
         No Newton mark on the fields: in a conversation with Newton it's obvious who filled them (Daria, 26.09).
         A form about a thing shows the thing (AG.chat.formArt(d) → { k, d }, drawn like the options' pictures), and one that
         Newton filled can be sent as it is — d.decide: "Decide for me" under the block (Daria, 27.09) */
      const pic = AG.chat.formArt && AG.chat.formArt(d);
      const decide = !d.done && d.decide;
      return `<div class="cw cw-step${d.done ? ' is-done' : ' cw-ask'}">
        ${stepHead(d)}
        <div class="cw__body">${pic ? `<div class="cw-form__art">${artOf(pic)}</div>` : ''}<div class="cw-fields">${rows.join('')}</div></div>
        ${d.done ? '' : `<div class="cw__foot">${btn((AG.chat.stepCta && AG.chat.stepCta(d)) || d.cta || 'Save', 'submit', goal(d))}${d.hint ? `<span class="ag-hint">${esc(d.hint)}</span>` : ''}
          ${d.pool ? `<span class="cw__foot-end"><button class="ag-btn ag-btn--tertiary ag-btn--sm ag-btn--icon cw-roll tip-up" data-cw="reroll-fields" aria-label="${esc(d.reroll || 'Another version')}" data-hint="Roll the dice">${icon('dice')}</button></span>` : ''}</div>`}
      </div>${decide ? `<div class="cw-after">${decideBtn(decide)}</div>` : ''}`;
    },

    /* one object Newton made — the same card wherever a draft shows up (handoff 6.3) */
    draft(d) {
      return `<div class="cw">
        <div class="cw-draft__art">${nwIcon('Made by Newton')}${d.badge ? `<span class="ag-badge ag-badge--pink ag-badge--sm">${esc(d.badge)}</span>` : ''}</div>
        <div class="cw__body">
          <div><span class="cw__kicker">${esc(d.kicker || 'Draft')}</span>
            <div style="display:flex;align-items:baseline;gap:8px"><b class="text-title-t6" style="flex:1">${esc(d.title)}</b>${d.price ? `<span class="cw-draft__price">${esc(d.price)}</span>` : ''}</div>
            ${d.sub ? `<div class="cw__sub">${esc(d.sub)}</div>` : ''}</div>
          ${d.rows ? `<div class="cw-draft__rows">${d.rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>` : ''}
        </div>
        <div class="cw__foot">${btn(d.cta || 'Open draft', 'open')}${d.alt === false ? '' : d.altProto
          ? `<button class="ag-btn ag-btn--tertiary ag-btn--sm tip-up" data-proto-tip="Not in this prototype">${esc(d.alt)}</button>`
          : btn(d.alt || 'Change it', 'edit', 'ag-btn ag-btn--tertiary ag-btn--sm')}</div>
      </div>`;
    },

    /* nothing to generate from → 2-3 ready starts instead of an empty state (handoff 6.2, rule 2) */
    options(d) {
      /* one block: the step, the choices, one action (+ "write my own", + reroll when there are more).
         Once chosen it stays as a record: only the pick, no buttons, no labels. */
      const list = d.done ? d.options.filter((o, i) => i === d.picked) : d.options;
      /* visual: each option is a card with a picture of the thing itself (o.art — markup the flow gives) */
      const vis = d.options.some((o) => o.art);
      /* a card IS the thing (Daria, 27.09): the hub's own card, big — its name and price are on it; under it only
         what's inside. No second title, no card inside a card. */
      const cap = (o) => String(o.cap || o.sub || '').replace(/\s*·\s*\$[\d.,]+/g, '');
      /* one main action; "write my own" the quietest (a tooltip in the prototype), the dice next to it;
         "decide" goes under the block — it finishes the whole task, not this step (Daria, 27.09) */
      const cta = (AG.chat.stepCta && AG.chat.stepCta(d)) || d.cta || 'Create draft';
      const decide = d.decide && !d.redo && !d.done ? ((AG.chat.decideLabel && AG.chat.decideLabel(d)) || d.decide) : '';
      return `<div class="cw cw-step${d.done ? ' is-done' : ' cw-ask'}">
        ${stepHead(d)}
        <div class="cw__body"><div class="${vis ? 'cw-opts--cards' : ''}">${list.map((o) => { const i = d.options.indexOf(o), rec = !d.done && i === recOf(d) && d.options.length > 1; return `<button class="cw-opt${vis ? ' cw-opt--card' : ''}${d.picked === i ? ' is-on' : ''}${o.rolled ? ' cw-rolling' : ''}" data-cw="pick" data-i="${i}" aria-pressed="${d.picked === i}" aria-label="${esc(o.title)}"${d.done ? ' disabled' : ''}>
            ${rec ? REC : ''}${vis ? `<span class="cw-opt__art">${artOf(o.art, o)}</span>${cap(o) ? `<span class="cw-opt__cap">${esc(cap(o))}</span>` : ''}`
              : `<span class="cw-opt__mark"></span><span class="cw-opt__txt"><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</span>`}</button>`; }).join('')}</div></div>
        ${d.done ? (d.doneLink && !here(d.route) ? `<div class="cw__foot">${btn(d.doneLink, 'open-done', 'ag-btn ag-btn--tertiary ag-btn--sm')}</div>` : '')
          : `<div class="cw__foot">${btn(cta, 'create', goal(d), d.picked == null ? 'disabled' : '')}${d.own ? '<button class="ag-btn ag-btn--tertiary ag-btn--sm cw-own tip-up" data-proto-tip="Not in this prototype">Edit</button>' : ''}
            ${d.pool ? `<span class="cw__foot-end"><button class="ag-btn ag-btn--tertiary ag-btn--sm ag-btn--icon cw-roll tip-up" data-cw="reroll-opt" aria-label="${esc(d.reroll || 'Show others')}" data-hint="Roll the dice">${icon('dice')}</button></span>` : ''}</div>`}
      </div>${decide ? `<div class="cw-after">${decideBtn(decide)}</div>` : ''}`;
    },

    /* a proposal to make something — the same block as a step of the event; answered, it goes quiet */
    offer(d) {
      return `<div class="cw cw-step${d.done ? ' is-done' : ' cw-ask'}">
        ${stepHead(d)}
        <div class="cw__body"><div class="chat__text">${rich(d.text)}</div></div>
        ${d.done ? (d.keep ? `<div class="cw__foot">${btn(d.cta || 'Yes', 'offer-yes')}</div>` : d.note ? `<div class="cw__foot"><span class="cw__sub">${esc(d.note)}</span></div>` : '')
          : `<div class="cw__foot">${btn(d.cta || 'Yes', 'offer-yes', d.quiet ? undefined : AI)}${d.alt ? btn(d.alt, 'offer-no', 'ag-btn ag-btn--tertiary ag-btn--sm') : ''}</div>`}
      </div>`;
    },

    /* a signal in the chat (Daria, 27.09): the same card as on the Dashboard pages — the level colour (1 broken, 2 needs a
       look, 3 advice), the title is the finding, one line why, the number only where there's a real one, and the one thing
       to do: the Newton button (he does it) with a quiet "Not now". { type: 'signal', lv, title, sub, sig: { v, u, bar }, cta, alt, altNote }.
       Answered — a quiet line: the title and what was done. The answer goes out like an offer's (onAction('offer')). */
    signal(d) {
      if (d.done) return `<div class="cw cw-sig-done"><b>${esc(d.title)}</b>${d.note ? `<span>${esc(d.note)}</span>` : ''}</div>`;
      return ctaCard(d, 'data-cw="offer-yes"');
    },

    /* switches: several things on or off, each applies at once (Hub: which categories show on the store page) */
    toggles(d) {
      return `<div class="cw cw-step cw-ask">
        ${stepHead(d)}
        <div class="cw__body"><div class="cw-tog">${d.items.map((it, i) => `<label class="cw-tog__row"><span>${esc(it.label)}</span>
          <span class="ag-toggle"><input type="checkbox" data-cw="toggle" data-i="${i}"${it.on ? ' checked' : ''}><span class="ag-toggle__track"></span></span></label>`).join('')}</div></div>
      </div>`;
    },

    /* one line after Newton put something in its place: what, where, and a way to it */
    added(d) {
      return `<div class="cw cw-added">${icon('check')}
        <span class="cw-added__txt"><b>${esc(d.title)}</b><span>${esc(d.where)} · ${esc(d.status || 'Draft')}</span></span>
        ${btn(d.cta || 'Open', 'open', 'ag-btn ag-btn--outline ag-btn--sm')}</div>`;
    },

    /* a package of objects across sections (an event): one row per object, one action for all of it */
    /* the finished event (Daria, 27.09 — it read dry): the event's own banner on top, a line that says it's done and how
       fast, the pieces and where they went, the whole list of what Newton did folded under it, one click to schedule.
       Scheduled — it turns into the success state (the page fires the confetti). */
    pack(d) {
      const did = d.did && d.did.steps && d.did.steps.length;
      return `<div class="cw cw-step cw-pack${d.scheduled ? ' is-live' : ' cw-ask'}">
        ${d.art ? `<div class="cw-pack__art">${artOf(d.art, {})}</div>` : ''}<!-- no "Scheduled" sticker on the picture (Daria, 28.09) -->
        ${d.title || d.step ? `<div class="cw-step__head"><b>${esc(d.title)}</b>${d.step ? `<span class="cw-step__n">${esc(d.step)}</span>` : ''}</div>` : ''}
        <!-- a proper heading with air round it, what Newton did right under it (Daria, 28.09) -->
        ${d.heading ? `<div class="cw-pack__head"><h3>${esc(d.scheduled ? (d.liveHeading || d.heading) : d.heading)}</h3>
          ${did ? `<div class="chat__did cw-pack__did${d.open ? ' is-open' : ''}"><button class="chat__did-head" data-cw="toggle" aria-expanded="${!!d.open}">${esc(d.did.title)}${icon('right')}</button>
            ${d.open ? `<ul class="chat__did-list">${d.did.steps.map((s) => `<li>${rich(s).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>` : ''}</div>` : ''}</div>` : ''}
        ${d.lead ? `<div class="cw-pack__lead">${rich(d.scheduled ? (d.liveLead || d.lead) : d.lead)}</div>` : ''}
        <div class="cw__body"><div class="cw-pkg">${d.rows.map((r, i) => `<button class="cw-pkg__row" data-cw="open" data-i="${i}">
          <span class="cw-pkg__txt"><b>${esc(r.title)}</b><span>${esc(r.sec)}</span></span>${icon('right')}</button>`).join('')}</div>
          ${did && !d.heading ? `<div class="chat__did cw-pack__did${d.open ? ' is-open' : ''}"><button class="chat__did-head" data-cw="toggle" aria-expanded="${!!d.open}">${esc(d.did.title)}${icon('right')}</button>
            ${d.open ? `<ul class="chat__did-list">${d.did.steps.map((s) => `<li>${rich(s).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>` : ''}</div>` : ''}</div>
        ${d.scheduled ? `<div class="cw__foot">${btn('Cancel event', 'unschedule', 'ag-btn ag-btn--tertiary ag-btn--sm')}${d.countdown ? `<span class="cw-pack__count">${esc(d.countdown)}</span>` : ''}</div>` : d.blocked
          ? `<div class="cw__foot">${btn(d.blockedCta || 'Verify company', 'unblock', PRI)}${d.heading ? '' : `<span class="ag-hint">${esc(d.blocked)}</span>`}${d.countdown ? `<span class="cw-pack__count">${esc(d.countdown)}</span>` : ''}</div>`
          : `<div class="cw__foot">${btn(d.cta || 'Schedule', 'schedule', PRI)}${d.countdown ? `<span class="cw-pack__count">${esc(d.countdown)}</span>` : ''}</div>`}
      </div>`;
    },

    /* what Newton did on his own, each with a way back (audit for publishers) */
    log(d) {
      return `<div class="cw">
        <div class="cw__head">${d.kicker ? `<span class="cw__kicker">${nwIcon()}${esc(d.kicker)}</span>` : ''}<b>${esc(d.title || '')}</b></div>
        <!-- short lines, the details open on a click; Undo shows on hover (Daria, 28.09: all of it at once was noise) -->
        <div class="cw__body"><div class="cw-log">${d.rows.map((r, i) => `<div class="cw-log__row${r.undone ? ' is-undone' : ''}">
          <details class="cw-log__txt"><summary>${esc(r.short || r.text).replace(/(\S+)$/, `<span class="cw-log__end">$1${icon('chev')}</span>`)}</summary>
            <span>${esc(r.text)}${r.when ? ` · ${esc(r.when)}` : ''}</span></details>
          <button class="ag-btn ag-btn--tertiary ag-btn--sm ag-btn--icon cw-log__undo tip-up" data-cw="undo" data-i="${i}" aria-label="${r.undone ? 'Redo' : 'Undo'}" data-hint="${r.undone ? 'Redo' : 'Undo'}">${icon(r.undone ? 'redo' : 'undo')}</button></div>`).join('')}</div></div>
      </div>`;
    },

    /* an answer in numbers — and where they came from */
    stats(d) {
      const max = Math.max(...d.bars.map((b) => (Array.isArray(b) ? b[0] : b)));
      return `<div class="cw"><div class="cw__body">
          <div><span class="cw__kicker">${nwIcon()}${esc(d.kicker || 'From your data')}</span>
            <div class="cw-stat"><b>${esc(d.value)}</b>${d.delta ? `<span class="ag-badge ag-badge--${d.up ? 'green' : 'orange'}-tertiary ag-badge--sm">${esc(d.delta)}</span>` : ''}</div>
            <div class="cw__sub">${esc(d.label)}</div></div>
          <div>
            <div class="cw-bars">${d.bars.map((b) => { const v = Array.isArray(b) ? b[0] : b, k = Array.isArray(b) ? b[2] : ''; return `<i class="${k}" style="height:${Math.round((v / max) * 100)}%"></i>`; }).join('')}</div>
            <div class="cw-axis">${d.bars.map((b) => `<span>${esc(Array.isArray(b) ? b[1] : '')}</span>`).join('')}</div>
          </div>
          ${d.read ? `<div class="chat__text">${rich(d.read)}</div>` : ''}
        </div>
        <div class="cw__foot">${btn(d.cta || 'Open in Analytics', 'open', 'ag-btn ag-btn--outline ag-btn--sm')}<span class="ag-hint">${esc(d.source || 'Analytics → Reports')}</span></div>
      </div>`;
    },

    /* what is still between the game and its first sale (handoff 6.6.1) */
    checklist(d) {
      return `<div class="cw"><div class="cw__body"><div class="cw-check">
        ${d.steps.map((s, i) => `<div class="cw-check__row">
          <span class="cw-check__st">${s.done ? icon('check') : '<span class="dot"></span>'}</span>
          <span class="cw-check__txt${s.done ? ' is-done' : ''}"><b>${esc(s.title)}</b><span>${esc(s.sub || '')}</span></span>
          ${s.done ? '<span class="ag-badge ag-badge--green-tertiary ag-badge--sm">Done</span>' : btn(s.cta || 'Open', 'step', 'ag-btn ag-btn--outline ag-btn--sm', `data-i="${i}"`)}
        </div>`).join('')}
      </div></div></div>`;
    },

    /* several results at once: lock the one you like, reroll the rest (handoff 6.2, rule 3) */
    variants(d) {
      return `<div class="cw">
        <div class="cw__head"><span class="cw__kicker">${nwIcon()}${esc(d.kicker || 'Three takes')}</span><b>${esc(d.title || '')}</b></div>
        <div class="cw__body"><div>${d.items.map((it, i) => `<div class="cw-var${it.locked ? ' is-locked' : ''}${it.rolled ? ' cw-rolling' : ''}">
          <span class="cw-var__txt">${esc(it.title)}${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</span>
          <button class="cw-var__lock" data-cw="lock" data-i="${i}" aria-pressed="${!!it.locked}" aria-label="${it.locked ? 'Unlock' : 'Keep this one'}">${icon(it.locked ? 'lock' : 'unlock')}</button>
        </div>`).join('')}</div></div>
        <div class="cw__foot">${btn(d.cta || 'Use these', 'use', PRI)}${btn('Reroll', 'reroll', 'ag-btn ag-btn--outline ag-btn--sm')}<span class="ag-hint">Locked ones stay.</span></div>
      </div>`;
    }
  };

  /* ================= engine ================= */
  let seq = 0;
  /* what an empty input suggests when the page has nothing of its own */
  const HINTS = ['What should I sell this week?', 'Build a Halloween event', 'Why did revenue drop on Wednesday?', 'Make a bundle under $5'];

  function mount(el, opts = {}) {
    const o = Object.assign({ state: 'moderate', placeholder: 'Message Newton', messages: [], suggestions: [], answers: [], pins: [], hints: HINTS }, opts);
    if (o.pin && !(opts.pins || []).length) o.pins = [o.pin];   // one pin, the old way
    o.messages = o.messages.map(norm);
    seq = Math.max(seq, o.seq || 0, ...o.messages.map((m) => Number(m.id) || 0));   // a saved conversation keeps its ids (seq: the highest id in the others)
    const changed = () => { if (o.onChange) o.onChange(o.messages.filter((m) => !m.typing)); };

    const chat = {
      el, opts: o,
      get messages() { return o.messages; },

      /* ---- saying things ---- */
      /* muffle: while Newton works through a plan of several jobs, each job's own messages are kept but out of sight —
         the plan block is what you watch (Daria, 28.09) */
      push(m) { const x = norm(m); if (o.muffle) x.archived = true; o.messages.push(x); append(x); changed(); return x; },
      you(text) { return chat.push({ from: 'you', text }); },
      newton(m) { chat.stopThinking(); return chat.push(Object.assign({ from: 'newton' }, typeof m === 'string' ? { text: m } : m)); },
      thinking(label) {
        chat.stopThinking();
        if (o.muffle) return null;
        return chat.push({ from: 'newton', typing: true, text: label || '' });
      },
      stopThinking() {
        const i = o.messages.findIndex((m) => m.typing);
        if (i > -1) { const [m] = o.messages.splice(i, 1); const n = node(m.id); if (n) n.remove(); }
      },
      /* Newton answers after a beat — the pause is what makes it read as thinking, not printing */
      say(m, delay = 700, label) {
        chat.thinking(label);
        return new Promise((res) => setTimeout(() => res(chat.newton(m)), delay));
      },

      /* ---- changing what is already said ---- */
      update(id, patch) {
        const m = o.messages.find((x) => x.id === id); if (!m) return;
        Object.assign(m, patch);
        m.stream = false;   // changed while it was still typing: it's just there now, whole
        const n = node(id); if (!n) return;
        n.outerHTML = msgHTML(m, prevOf(m));
        const fresh = node(id); if (fresh) fresh.style.animation = 'none';   // a change in place, not a new message
        syncHero(); changed();
      },
      widget(id, patch) {
        const m = o.messages.find((x) => x.id === id); if (!m || !m.widget) return;
        Object.assign(m.widget, patch);
        chat.update(id, {});
      },
      remove(id) { const i = o.messages.findIndex((x) => x.id === id); if (i > -1) { o.messages.splice(i, 1); const n = node(id); if (n) n.remove(); syncHero(); changed(); } },
      clear() { o.messages = []; draw(); changed(); },
      /* another conversation in the same panel (a page has its own): drawn as it was, nothing animates in */
      load(list) { o.messages = (list || []).map(norm); seq = Math.max(seq, ...o.messages.map((m) => Number(m.id) || 0)); draw(); },

      /* ---- the shell ---- */
      setSuggestions(list) { o.suggestions = list || []; const s = $('.chat__sugg', el); if (s) s.innerHTML = suggHTML(); },
      setPins(list) { o.pins = list || []; const n = $('.chat__pin-wrap', el); if (n) n.outerHTML = pinHTML(); },
      setPin(pin) { chat.setPins(pin ? [pin] : []); },
      setAlerts(list) { o.alerts = list || []; const n = $('.chat__alerts', el); if (n) n.outerHTML = alertsHTML(); },
      setState(state, extra) { Object.assign(o, { state }, extra || {}); draw(); },
      /* a new width for a new context: the panel slides, the conversation stays as it was */
      width(state, extra) { if (o.state === state && !extra) return; Object.assign(o, { state }, extra || {}); draw(); },
      /* ready questions belong to the empty state: once the conversation starts, the follow-ups
         come from Newton's own answers. Pass keepSuggestions to keep them in the dock. */
      ask(text) { chat.you(text); if (!o.keepSuggestions && o.suggestions.length) chat.setSuggestions([]); reply(text); },
      focus() { const i = $('.chat__in', el); if (i) i.focus(); },
      hint(text) { o.hold = text || null; showHint(true); },
      scroll() { toBottom(true); }
    };

    /* ---------- drawing ---------- */
    const node = (id) => $(`[data-mid="${id}"]`, el);
    const prevOf = (m) => o.messages[o.messages.indexOf(m) - 1];

    function draw() {
      mountChat(el, {
        state: o.state, rail: o.rail, back: o.back,
        body: `<div class="chat__top">${pinHTML()}${alertsHTML()}</div><div class="nw-col chat__stream">${shown() || !o.hero ? '' : heroHTML()}${o.messages.map((m, i) => msgHTML(m, o.messages[i - 1], true)).join('')}</div>`,
        foot: o.dock === false ? '' : dockHTML()   // kept even in the rail, so reopening it is instant
      });
      bind();
      toBottom(false);
    }
    /* twice: once now, once after the widgets in the message have laid out */
    function toBottom(smooth) {
      const b = $('.nw-chat__body', el); if (!b) return;
      const go = () => b.scrollTo({ top: b.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      go(); requestAnimationFrame(go); setTimeout(go, 120);
    }
    /* the empty state counts what's on screen: when every message is put away (a new visit), "How can I help?" is back */
    const shown = () => o.messages.some((m) => !m.folded && !m.archived);
    function syncHero() {
      const s = $('.chat__stream', el); if (!s) return;
      const hero = $('.chat__hero', s);
      if (shown() && hero) hero.remove();
      else if (!shown() && !hero && o.hero) s.insertAdjacentHTML('afterbegin', heroHTML());
      else if (!shown() && hero && o.hero && typeof o.hero.title === 'function') { const h = $('h2', hero), t = o.hero.title(); if (h && h.dataset.type !== t) { h.dataset.type = t; delete h.dataset.typing; h.textContent = ''; typeHero(); } }   // a new visit: its own line, typed
    }
    function append(m) {
      const s = $('.chat__stream', el);
      if (!s) return draw();
      const hero = $('.chat__hero', s); if (hero) hero.remove();
      s.insertAdjacentHTML('beforeend', msgHTML(m, o.messages[o.messages.indexOf(m) - 1]));
      chat.scroll();
      if (m.stream) stream(m);
    }
    /* the text types itself in, a word at a time; then the rest of the message (its widget) comes in */
    function stream(m) {
      const n = node(m.id), t = n && $('.chat__text', n);
      if (!n || !n.classList.contains('is-streaming') || !t) { m.stream = false; return; }
      const words = String(m.text).split(' ');
      let i = 0;
      const tick = () => {
        if (!n.isConnected) return;
        i = Math.min(words.length, i + 1);
        t.innerHTML = rich(words.slice(0, i).join(' '));
        if (i < words.length) { setTimeout(tick, 42); return; }
        m.stream = false; n.classList.remove('is-streaming'); n.classList.add('is-streamed'); changed(); chat.scroll();
        if (o.onStreamed) o.onStreamed(m);
      };
      tick();
    }

    /* the empty chat (Daria, 28.09): no orb — one pale line on the left, typed out once like Newton's messages */
    const typedHero = new Set();
    function typeHero() {
      const h = $('.chat__hero h2[data-type]', el); if (!h || h.dataset.typing) return;
      const t = h.dataset.type; if (typedHero.has(t) || matchMedia('(prefers-reduced-motion: reduce)').matches) { h.textContent = t; typedHero.add(t); return; }
      h.dataset.typing = '1'; let i = 0;
      const step = () => { if (!h.isConnected) return; h.textContent = t.slice(0, ++i); if (i < t.length) setTimeout(step, 22 + Math.random() * 30); else typedHero.add(t); };
      step();
    }
    const heroHTML = () => { const t = typeof o.hero.title === 'function' ? o.hero.title() : o.hero.title; setTimeout(typeHero, 0);
      return `<div class="chat__hero"><h2 data-type="${esc(t)}">${typedHero.has(t) ? esc(t) : ''}</h2>${o.hero.lead ? `<p>${esc(o.hero.lead)}</p>` : ''}</div>`; };

    /* still: drawn again (new width, a page reload) — only a new message animates in */
    function msgHTML(m, prev, still) {
      if (m.folded || m.archived) return `<div class="chat__msg" data-mid="${m.id}" hidden></div>`;   // put away: into its strip on top, or done on an earlier visit
      const st = still ? ' style="animation:none"' : '';
      if (m.from === 'you') return `<div class="chat__msg chat__msg--you" data-mid="${m.id}"${st}><div class="chat__bubble">${esc(m.text)}</div></div>`;
      const streaming = m.stream && !still && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      /* no avatar next to Newton's messages (Daria, 27.09): the panel is his, the text says who's talking */
      if (m.typing) return `<div class="chat__msg chat__msg--nw" data-mid="${m.id}"><div class="chat__row">
        <div class="chat__think"><span></span><span></span><span></span>${m.text ? `<em>${esc(m.text)}</em>` : ''}</div></div></div>`;
      if (m.widget) m.widget._id = m.id;
      return `<div class="chat__msg chat__msg--nw${streaming ? ' is-streaming' : ''}" data-mid="${m.id}"${st}><div class="chat__row"><div class="chat__body">
        ${m.tag ? `<span class="ag-badge ag-badge--${esc(m.tag[1] || 'gray-secondary')} ag-badge--sm chat__tag">${esc(m.tag[0])}</span>` : ''}
        ${m.did ? didHTML(m) : ''}
        ${m.text ? `<div class="chat__text">${streaming ? '' : rich(m.text)}</div>` : ''}
        ${m.widget ? `<div class="chat__wid">${(widgets[m.widget.type] || (() => ''))(m.widget)}</div>` : ''}
        ${visActs(m).length ? `<div class="chat__acts">${m.actions.map((a, i) => here(a.at) ? '' : `<button class="ag-btn ${ACT[a.kind] || 'ag-btn--outline'} ag-btn--sm" data-chat-act="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
        ${m.note ? `<div class="chat__note">${esc(m.note)}</div>` : ''}
        ${m.chips && m.chips.length ? `<div class="chat__chips">${m.chips.map(chipHTML).join('')}</div>` : ''}
        ${toolsHTML(m)}
      </div></div></div>`;
    }
    /* what Newton actually did, above his answer (Daria, 27.09 — like an agent's "Ran 3 commands ›"):
       one grey line, the list of changes opens under it. m.did: { title, steps: [] } */
    const didHTML = (m) => `<div class="chat__did${m.didOpen ? ' is-open' : ''}">
      <button class="chat__did-head" data-chat-did="${m.id}" aria-expanded="${!!m.didOpen}">${esc(m.did.title)}${m.did.steps && m.did.steps.length
        ? `${m.did.count === false ? '' : ` · ${m.did.steps.length} ${m.did.steps.length === 1 ? 'change' : 'changes'}`}${icon('right')}` : ''}</button>
      ${m.didOpen && m.did.steps ? `<ul class="chat__did-list">${m.did.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}</div>`;
    /* under every Newton message, on hover: when he said or did it (Daria, 26.09: the date is just "Today" for now) */
    const when = (m) => `<span class="chat__time">Today, ${new Date(m.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>`;
    const toolsHTML = (m) => (m.tools === false ? `<div class="chat__tools">${when(m)}</div>` : `<div class="chat__tools">
      <button class="chat__tool" data-chat-tool="copy" data-mid="${m.id}" aria-label="Copy">${icon('copy')}</button>
      <button class="chat__tool${m.vote === 1 ? ' is-on' : ''}" data-chat-tool="up" data-mid="${m.id}" aria-label="Good answer">${icon('up')}</button>
      <button class="chat__tool${m.vote === -1 ? ' is-on' : ''}" data-chat-tool="down" data-mid="${m.id}" aria-label="Off the mark">${icon('down')}</button>${when(m)}
    </div>`);

    /* the pin: unfinished work — a ring with how many steps are done (pin.done / pin.of), otherwise Newton's spark;
       no "Continue" word, the arrow says it (Daria, 26.09) */
    const pinLead = (p) => (p.of ? `<span class="ag-ring chat__pin-ring" style="--v:${(p.done / p.of) * 100}" aria-hidden="true"></span>` : '');
    /* unfinished work, one strip per task, stacked (Daria, 27.09 — settled): it can't be closed, it's the way back to the
       task. No cross, no spark: the progress ring where the task has steps (verification 2/4, the event 3/5), the task,
       under it how far it's got and where, and a chevron — a click picks the task up again at the end of the chat.
       Cancelling a task is Cancel inside it. (onPinClose stays in the engine, nothing calls it now.) */
    const pinRow = (p, i) => `<div class="chat__pin-row">
      <button class="chat__pin" data-chat-pin="${i}" aria-label="Back to: ${esc(p.text)}">${pinLead(p)}<span class="chat__card-body"><b>${esc(p.text)}</b>${p.note ? `<small>${esc(p.note)}</small>` : ''}</span>${icon('right', 'chat__pin-go')}</button></div>`;
    /* many unfinished tasks don't pile up (Daria, 28.09): past two they lie in a deck — the first on top, the edges of the
       others under it, and "N more"; a click fans the deck out, "Show less" folds it back */
    const pinHTML = () => {
      const list = o.pins || [];
      if (list.length <= 2) return `<div class="chat__pin-wrap">${list.map(pinRow).join('')}</div>`;
      if (o.pinsOpen) return `<div class="chat__pin-wrap is-fanned">${list.map(pinRow).join('')}<button class="chat__pin-less" data-chat-pins="close">Show less</button></div>`;
      return `<div class="chat__pin-wrap is-deck" style="--under:${Math.min(2, list.length - 1)}">${pinRow(list[0], 0)}
        <button class="chat__pin-deck" data-chat-pins="open" aria-label="Show all ${list.length} unfinished tasks"><span>${list.length - 1} more unfinished</span></button></div>`;
    };
    /* a question the prototype can't answer yet stays on screen (it's part of the idea), but it only shows a
       tooltip — o.wired(q) says which ones work (Daria, 26.09: block, don't remove) */
    const chipHTML = (q) => (o.wired && !o.wired(q)
      ? `<button class="chat__chip tip-up" data-proto-tip="Not in this prototype" aria-disabled="true">${esc(q)}</button>`
      : `<button class="chat__chip" data-chat-q="${esc(q)}">${esc(q)}</button>`);
    const suggHTML = () => (o.suggestions || []).map(chipHTML).join('');
    /* a problem isn't a message: it stays at the top of the panel, with the pin, until it's fixed (Daria, 26.09).
       Built like the pin: the icon on the first line, a bold line, a grey note, the action under the text. */
    /* several problems don't pile up (Daria, 28.09): past one they lie in a deck — the most urgent on top, the edges of the
       others under it and "N more"; a click fans them out, each card opens its own fix, "Show less" folds them back */
    const alertCard = (a, i) => ctaCard({ lv: a.lv || 2, kind: a.type, title: a.title, sub: a.sub || a.note, sig: a.sig, cta: a.action && a.action.label }, a.action ? `data-chat-alert="${i}"` : '');
    const alertsHTML = () => {
      const list = o.alerts || [];
      if (list.length <= 1) return `<div class="chat__alerts">${list.map(alertCard).join('')}</div>`;
      if (o.alertsOpen) return `<div class="chat__alerts is-fanned">${list.map(alertCard).join('')}<button class="chat__pin-less" data-chat-alerts="close">Show less</button></div>`;
      return `<div class="chat__alerts is-deck" style="--under:${Math.min(2, list.length - 1)}">${alertCard(list[0], 0)}
        <button class="chat__alerts-more" data-chat-alerts="open" aria-label="Show all ${list.length} problems">${list.length - 1} more to fix</button></div>`;
    };
    const dockHTML = () => `<div class="chat__dock"><div class="chat__col">
      <div class="chat__sugg">${suggHTML()}</div>
      <form class="chat__field" data-chat-form>
        <button class="chat__plus tip-up" type="button" data-chat-tool="attach" aria-label="Add a file" data-proto-tip="Not in this prototype">${icon('clip')}</button>
        <label class="sr-only" for="chat-in-${el.id || 'x'}">${esc(o.placeholder)}</label>
        <span class="chat__in-wrap"><input class="chat__in" id="chat-in-${el.id || 'x'}" autocomplete="off"><span class="chat__hint" aria-hidden="true">${esc(hintNow())}</span></span>
        <button class="chat__mic tip-up" type="button" data-chat-tool="voice" aria-label="Voice input" data-proto-tip="Not in this prototype">${icon('mic')}</button>
        <button class="chat__send" aria-label="Send">${icon('send')}</button>
      </form>
    </div></div>`;

    /* ---------- answering ---------- */
    function reply(text) {
      if (o.onSend) return o.onSend(text, chat);
      const q = text.toLowerCase();
      const hit = (o.answers || []).find((a) => (a.match || []).some((k) => q.includes(k)));
      /* a canned reply is reused every time it is asked, so each answer gets its own copy —
         otherwise a picked option or a locked variant would leak into the next conversation */
      const src = hit ? (typeof hit.reply === 'function' ? hit.reply(chat, text) : hit.reply) : o.fallback;
      const m = src && !src.then ? JSON.parse(JSON.stringify(src)) : src;
      if (m === undefined) return;
      if (m && m.then) return m;                              // the answer takes care of itself
      chat.say(m, hit && hit.delay != null ? hit.delay : 800, hit && hit.thinking);
    }

    /* ---------- events ---------- */
    function bind() {
      if (el.dataset.chatBound) return;                        // one delegated listener per panel
      el.dataset.chatBound = '1';

      el.addEventListener('submit', (e) => {
        if (!e.target.matches('[data-chat-form]')) return;
        e.preventDefault();
        const i = $('.chat__in', el), v = i.value.trim();
        if (!v) return;
        i.value = ''; typed(i); chat.ask(v);
      });

      el.addEventListener('click', (e) => {
        const q = e.target.closest('[data-chat-q]');
        if (q) { chat.ask(q.dataset.chatQ); return; }
        const px = e.target.closest('[data-chat-pin-x]');
        if (px) { if (o.onPinClose) o.onPinClose(chat, (o.pins || [])[Number(px.dataset.chatPinX)]); return; }
        const ad = e.target.closest('[data-chat-alerts]');
        if (ad) { o.alertsOpen = ad.dataset.chatAlerts === 'open'; chat.setAlerts(o.alerts); return; }
        const pd = e.target.closest('[data-chat-pins]');
        if (pd) { o.pinsOpen = pd.dataset.chatPins === 'open'; chat.setPins(o.pins); return; }
        const pn = e.target.closest('[data-chat-pin]');
        if (pn) { if (o.onPin) o.onPin(chat, (o.pins || [])[Number(pn.dataset.chatPin)]); return; }
        const dh = e.target.closest('[data-chat-did]');
        if (dh) { const m = o.messages.find((x) => String(x.id) === dh.dataset.chatDid); if (m) chat.update(m.id, { didOpen: !m.didOpen }); return; }
        const al = e.target.closest('[data-chat-alert]');
        if (al) { const a = o.alerts[Number(al.dataset.chatAlert)]; if (o.alertsOpen) { o.alertsOpen = false; chat.setAlerts(o.alerts); }   // picked one: the deck folds, the fix gets the room
          if (a && o.onAction) o.onAction(a.action.act, { kind: 'alert', chat, alert: a }); return; }

        const t = e.target.closest('[data-chat-tool]');
        if (t) {
          const k = t.dataset.chatTool;
          if (k === 'attach' || k === 'voice') return;   // not built in the prototype: its tooltip says so
          const m = o.messages.find((x) => String(x.id) === t.dataset.mid);
          if (k === 'copy' && m) { navigator.clipboard && navigator.clipboard.writeText(m.text || ''); return toast('Copied'); }
          if (m) { m.vote = m.vote === (k === 'up' ? 1 : -1) ? 0 : (k === 'up' ? 1 : -1); chat.update(m.id, {}); toast(m.vote === 1 ? 'Thanks — more like this' : m.vote === -1 ? 'Noted, I’ll try another way' : 'Cleared'); }
          return;
        }

        const ma = e.target.closest('[data-chat-act]');
        if (ma) {
          const m = o.messages.find((x) => String(x.id) === ma.closest('[data-mid]').dataset.mid); if (!m) return;
          const action = m.actions[Number(ma.dataset.chatAct)];
          m.used = true; changed();                             // touched: it's part of the conversation now
          if (action.q) { chat.update(m.id, { actions: [] }); chat.ask(action.q); }   // answered: the question stays, its buttons go
          else if (o.onAction) o.onAction(action.act, { kind: 'msg', chat, msg: m, action });
          return;
        }

        const a = e.target.closest('[data-cw]');
        if (!a) return;
        const wrap = a.closest('[data-mid]'); if (!wrap) return;
        const m = o.messages.find((x) => String(x.id) === wrap.dataset.mid); if (!m || !m.widget) return;
        const d = m.widget, i = a.dataset.i != null ? Number(a.dataset.i) : null, act = a.dataset.cw;
        m.used = true;

        /* what the engine owns: picking, locking, rerolling */
        if (act === 'pick') { d.picked = i; chat.update(m.id, {}); return; }
        if (act === 'offer-yes') { const again = d.done; d.done = true; if (!again) chat.update(m.id, {}); if (d.q && !again) chat.ask(d.q); else if (o.onAction) o.onAction('offer', { chat, msg: m, data: d }); return; }   // keep: answered, its button stays (a quiet outline) and still works
        if (act === 'offer-no') { d.done = true; d.note = d.altNote || 'OK, not now.'; chat.update(m.id, {}); if (o.onAction) o.onAction('offer-no', { chat, msg: m, data: d }); return; }   // the page may keep the answer
        if (act === 'undo') { d.rows[i].undone = !d.rows[i].undone; chat.update(m.id, {}); if (o.onAction) o.onAction('undo', { chat, msg: m, data: d, i }); return; }   // the page may keep it
        if (act === 'reroll-opt') {
          /* the dice deals a whole new set: every option changes, never one already on screen
             (unless the pool is too small — then the rest comes from what's left, reshuffled) */
          const on = d.options.map((x) => x.title), pool = d.pool || [];
          const fresh = pool.filter((x) => !on.includes(x.title)).sort(() => Math.random() - 0.5);
          const rest = pool.filter((x) => on.includes(x.title)).sort(() => Math.random() - 0.5);
          d.options = fresh.concat(rest).slice(0, d.options.length).map((x) => Object.assign({}, x, { rolled: true }));
          d.picked = 0; if (d.rec !== false) d.rec = 0;   // the new set has its own recommended one
          chat.update(m.id, {}); return;
        }
        if (act === 'edit') { d.done = false; d.redo = true; chat.update(m.id, {}); return; }   // reopen a passed step; the flow decides what "done again" means
        if (act === 'lock') { d.items[i].locked = !d.items[i].locked; chat.update(m.id, {}); return; }
        if (act === 'toggle' && d.type !== 'toggles') { d.open = !d.open; chat.update(m.id, {}); return; }   // a folded list inside a block (a switch of the toggles widget goes to the page)
        if (act === 'reroll-fields') {   // the dice on a form: the next version of the words Newton wrote (d.pool: [[v0, v1…], …])
          d.variant = ((d.variant || 0) + 1) % d.pool.length;
          d.pool[d.variant].forEach((v, k) => { if (d.fields[k]) Object.assign(d.fields[k], { value: v, edited: false }); });   // Newton's words again
          chat.update(m.id, {}); const w = node(m.id); if (w) w.querySelectorAll('.ag-input').forEach((x) => x.classList.add('cw-rolling')); return;
        }
        if (act === 'reroll') {
          /* deal from what is left, so a reroll never repeats a variant already on screen */
          const kept = d.items.filter((x) => x.locked).map((x) => x.title);
          const left = (d.pool || []).filter((x) => !kept.includes(x.title)).sort(() => Math.random() - 0.5);
          d.items = d.items.map((it) => (it.locked || !left.length ? Object.assign({}, it, { rolled: false })
            : Object.assign({}, left.pop(), { rolled: true })));
          chat.update(m.id, {}); return;
        }
        if (o.onAction) o.onAction(act, { chat, msg: m, data: d, i, el: a });
      });

      el.addEventListener('input', (e) => {
        if (e.target.matches('.chat__in')) return typed(e.target);
        const f = e.target.closest('[data-cw="field"]'); if (!f) return;
        const wrap = f.closest('[data-mid]');
        const m = o.messages.find((x) => String(x.id) === wrap.dataset.mid); if (!m) return;
        const x = m.widget.fields[Number(f.dataset.i)];
        x.value = f.value; changed();
        const pic = AG.chat.formArt && AG.chat.formArt(m.widget), box = pic && $('.cw-form__art', wrap);
        if (box) box.innerHTML = AG.chat.art ? AG.chat.art(pic) : '';
        if (!x.edited) { x.edited = true; const ai = x.newton && $('.ai-ico', f.parentNode); if (ai) ai.remove(); }  // any field typed over counts as changed; Newton's mark goes after a manual edit (handoff 6.8)
      });
    }

    /* the empty input shows what you could write here, one example after another, gently (Daria, 27.09) */
    let hintAt = 0;
    const hintList = () => { const h = typeof o.hints === 'function' ? o.hints() : o.hints; return h && h.length ? h : HINTS; };
    const hintNow = () => o.hold || hintList()[hintAt % hintList().length];
    function showHint(now) {
      const h = $('.chat__hint', el); if (!h) return;
      if (now) { h.textContent = hintNow(); return; }
      h.classList.add('is-out');
      setTimeout(() => { hintAt++; h.textContent = hintNow(); h.classList.remove('is-out'); }, 260);
    }
    const hintTimer = setInterval(() => {
      if (!el.isConnected) { clearInterval(hintTimer); return; }
      const f = $('.chat__field', el);
      if (o.hold || !f || f.classList.contains('is-typing') || hintList().length < 2) return;
      showHint(false);
    }, 3600);

    /* empty field — the mic; something typed — send takes its place (Daria, 27.09) */
    function typed(i) { const f = i.closest('.chat__field'); if (f) f.classList.toggle('is-typing', !!i.value.trim()); }

    function norm(m) {
      const x = typeof m === 'string' ? { from: 'newton', text: m } : Object.assign({}, m);
      x.id = x.id || ++seq;
      x.at = x.at || Date.now();
      return x;
    }

    draw();
    el.__chat = chat;
    return chat;
  }

  return { mount, widgets };
})();
