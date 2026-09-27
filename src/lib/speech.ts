/**
 * Browser voice dictation (Web Speech API).
 *
 * Safari exposes it as webkitSpeechRecognition and it is NOT everywhere:
 * several browsers lack it, and it's unreliable inside an installed web
 * app. That's why this returns `null` when there's no support, and the
 * screen using it always offers typing — dictating is the shortcut, not
 * the only way.
 *
 * TypeScript doesn't ship types for this API, so they're declared here,
 * minimal: only what gets used.
 */

interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean; length: number }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechEvent { resultIndex: number; results: SpeechResultList }
interface SpeechErrorEvent { error: string }

export interface Recognizer {
  start(): void;
  stop(): void;
}

type Constructor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function constructor(): Constructor | null {
  const w = window as unknown as {
    SpeechRecognition?: Constructor;
    webkitSpeechRecognition?: Constructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function hasDictation(): boolean {
  return typeof window !== 'undefined' && constructor() !== null;
}

/**
 * The recognizer that is alive right now, if there is one.
 *
 * Needed because start() on one that's already running throws
 * InvalidStateError, and it only takes one left unclosed —the tab lost
 * focus, the sheet closed halfway, iOS killed it on its own— for the next
 * attempt to fail. That used to be reported as "this browser won't let you
 * dictate", which is a lie and leaves the person with no way out: it is
 * exactly what "sometimes it doesn't work" looks like. Now the previous one
 * is released before asking for a new one.
 */
let activeRecognizer: { abort(): void } | null = null;

/**
 * How long to wait with no news before giving up.
 *
 * The recognizer should always report back through onend or onerror, but it
 * doesn't always: if another app holds the microphone, if the permission
 * gets stuck halfway, or because of known Safari bugs, nothing arrives.
 * Without this the button stays on "Stop listening" forever, there's no way
 * to recover without reloading, and it looks like the app froze.
 *
 * The timer restarts with every word that arrives, so it only fires when
 * genuinely nothing is happening.
 *
 * Four seconds. Twelve felt eternal with the button red and nothing
 * happening. The price: if someone taps the microphone and takes longer
 * than that to start speaking, it cancels and they have to tap again.
 */
const NO_NEWS_MS = 4_000;

export function listen(options: {
  lang?: string;
  onText: (text: string, final: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): Recognizer | null {
  const Ctor = constructor();
  if (!Ctor) return null;

  // Release the previous one no matter what: abort() on one that's already
  // dead does nothing, and leaving it alive is what breaks the next attempt.
  try {
    activeRecognizer?.abort();
  } catch {
    // It doesn't matter why it failed; what matters is not holding on to
    // the stale reference.
  }
  activeRecognizer = null;

  const rec = new Ctor();
  rec.lang = options.lang ?? 'es-CO';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    if (activeRecognizer === rec) activeRecognizer = null;
    options.onEnd();
  }

  function rearmWatchdog() {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      // Actually close it, not just on screen: if the recognizer is still
      // alive it holds the microphone and breaks the next attempt.
      try {
        rec.abort();
      } catch {
        // It was already dead.
      }
      options.onError('Se quedó esperando. Vuelve a intentarlo o escríbelo.');
      finish();
    }, NO_NEWS_MS);
  }

  rec.onresult = (e) => {
    rearmWatchdog();
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      text += r[0].transcript;
      if (r.isFinal) final = true;
    }
    options.onText(text.trim(), final);
  };

  rec.onerror = (e) => {
    options.onError(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'No me diste permiso para usar el micrófono.'
        : e.error === 'no-speech'
        ? 'No escuché nada.'
        : e.error === 'audio-capture'
        ? 'No encontré el micrófono.'
        : 'No pude escuchar. Escríbelo y listo.',
    );
  };

  rec.onend = finish;

  try {
    rec.start();
  } catch {
    // A second attempt: the abort() above can take a moment to release the
    // microphone, and this is exactly the case that left dictation unusable
    // until a reload.
    try {
      rec.abort();
      rec.start();
    } catch {
      return null;
    }
  }

  activeRecognizer = rec;
  rearmWatchdog();

  return {
    start: () => rec.start(),
    stop: () => {
      clearTimeout(watchdog);
      rec.stop();
    },
  };
}
