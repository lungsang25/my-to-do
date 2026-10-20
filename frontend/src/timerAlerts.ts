/** Ask once, when the user starts a timer (browsers require a click for this). */
export function requestNotifyPermission(): void {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* unsupported; the beep and on-page state still work */
  }
}

function beep(): void {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.2);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio not available */
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* not supported (e.g. desktop, iOS) */
  }
}

function notify(): void {
  try {
    // Only needed when the user can't see the page.
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Time's up", { body: "Your timer has finished." });
    }
  } catch {
    /* some mobile browsers only allow notifications via a service worker */
  }
}

/** Everything that happens when a timer reaches zero. */
export function alertTimerDone(): void {
  beep();
  vibrate();
  notify();
}
