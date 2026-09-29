"use strict";

/*
This script schedules one visual shake with every Tone.Loop note. The shared
timeline lets the prototype test rhythm feedback rather than a continuous state.
*/

/* Page elements and state -------------------------------------------------- */
const flowerButton = document.querySelector("#flower");
const soundStatus = document.querySelector("#sound-status");
const noteDuration = 0.28;
let flowerSynth;
let noteLoop;
let isPlaying = false;
let isAudioStarting = false;
let shouldPlay = false;

/* Rhythm feedback ---------------------------------------------------------- */
function shakeFlower() {
    if (!isPlaying) return;
    flowerButton.classList.remove("beatShake");

    // Reading layout lets the same class restart for every scheduled note.
    void flowerButton.offsetWidth;
    flowerButton.classList.add("beatShake");
}

function playBeat(scheduledTime) {
    flowerSynth.triggerAttackRelease("C4", noteDuration, scheduledTime, 0.65);

    // Tone.Draw places the shake on the visual frame matching the audio event.
    Tone.Draw.schedule(shakeFlower, scheduledTime);
}

function stopRhythm() {
    // Cancel queued audio and draw work before resetting the visual state.
    if (flowerSynth) {
        flowerSynth.volume.value = -100;
        flowerSynth.envelope.cancel(Tone.immediate());
        flowerSynth.triggerRelease(Tone.immediate());
    }
    if (noteLoop) {
        noteLoop.mute = true;
    }
    if (typeof Tone !== "undefined") {
        Tone.Draw.cancel(Tone.immediate());
        Tone.Transport.stop();
    }

    isPlaying = false;
    flowerButton.classList.remove("beatShake");
    flowerButton.setAttribute("aria-pressed", "false");
    soundStatus.textContent = "Rhythm stopped";
}

/* Audio and playing state -------------------------------------------------- */
async function startRhythm() {
    // Only one audio-start request and one loop can exist at a time.
    if (isAudioStarting || isPlaying) return;
    if (typeof Tone === "undefined") {
        shouldPlay = false;
        soundStatus.textContent = "Sound could not load. Check your connection and reload.";
        return;
    }

    isAudioStarting = true;
    try {
        // Browsers allow Tone.js audio only after the user's first activation.
        await Tone.start();
        if (!shouldPlay) return;
        if (Tone.getContext().state !== "running") {
            throw new Error("Audio context did not start");
        }
        if (!flowerSynth) {
            flowerSynth = new Tone.Synth({
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 0.025,
                    decay: 0.08,
                    sustain: 0.55,
                    release: 0.44,
                    releaseCurve: "linear"
                },
                volume: -16
            }).toDestination();
            Tone.Transport.bpm.value = 75;
            // One reusable loop matches Prototype 7 with a C4 every quarter note.
            noteLoop = new Tone.Loop(scheduledTime => {
                playBeat(scheduledTime);
            }, "4n").start(0);
            Tone.getContext().rawContext.addEventListener("statechange", () => {
                // A suspended audio context must not leave visual beats running alone.
                if (isPlaying && Tone.getContext().state !== "running") {
                    shouldPlay = false;
                    stopRhythm();
                    soundStatus.textContent = "Audio paused. Tap the flower to play again.";
                }
            });
        }

        // Reuse the same synth and loop whenever playback restarts.
        flowerSynth.envelope.cancel(Tone.immediate());
        flowerSynth.volume.value = -16;
        noteLoop.mute = false;
        Tone.Transport.position = 0;
        isPlaying = true;
        flowerButton.setAttribute("aria-pressed", "true");

        // A short lead lets the first note and every later beat share one timeline.
        Tone.Transport.start("+0.05");
        soundStatus.textContent = "Rhythm playing";
    } catch {
        shouldPlay = false;
        stopRhythm();
        soundStatus.textContent = "Sound could not start. Tap the flower to try again.";
    } finally {
        isAudioStarting = false;
    }
}

/* User input and accessibility -------------------------------------------- */
flowerButton.addEventListener("click", () => {
    // Rapid taps update the requested state instead of creating extra loops.
    shouldPlay = !shouldPlay;
    if (shouldPlay) {
        void startRhythm();
    } else {
        stopRhythm();
    }
});

function clearShake() {
    // Removing the temporary class prepares the next beat animation.
    flowerButton.classList.remove("beatShake");
}

flowerButton.addEventListener("animationend", clearShake);
flowerButton.addEventListener("animationcancel", clearShake);

// Native button clicks support mouse, touch, Enter and Space; held keys do not repeat.
flowerButton.addEventListener("keydown", event => {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && shouldPlay) {
        shouldPlay = false;
        stopRhythm();
    }
});
