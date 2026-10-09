/**
 * @fileoverview Super Kudla Express — Procedural Web Audio Engine.
 * Synthesizes music loops, station announcements, and sound effects.
 * Mohanam raga scale (C D E G A pentatonic).
 * Module contract per DESIGN.md section 8.4.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /** @type {?AudioContext} */
  let audioContext = null;

  /** @type {?GainNode} */
  let masterGain = null;

  /** @type {?GainNode} */
  let musicGain = null;

  /** @type {?GainNode} */
  let sfxGain = null;

  /** @type {?GainNode} */
  let rumbleGain = null;

  /** @type {?AudioBufferSourceNode} */
  let rumbleSource = null;

  /** @type {boolean} */
  let isMutedState = false;

  /** @type {?number} */
  let musicTimer = null;

  /** @type {string} */
  let activeMusicMode = 'none';

  /** @type {number} */
  let nextMusicNoteTime = 0;

  /** @type {number} */
  let musicStepIndex = 0;

  /** @type {?AudioBuffer} */
  let cachedNoiseBuffer = null;

  /**
   * Mohanam Raga (Major Pentatonic: C D E G A) frequency table in Hz.
   * @type {!Object<string, number>}
   */
  const MOHANAM_NOTES = Object.freeze({
    C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C6: 1046.50
  });

  /**
   * Original upbeat 16-step Mohanam lead sequence.
   * Completely distinct from any Nintendo theme or IR jingle.
   */
  const MAIN_LEAD_NOTES = [
    MOHANAM_NOTES.C4, MOHANAM_NOTES.E4, MOHANAM_NOTES.G4, MOHANAM_NOTES.A4,
    MOHANAM_NOTES.G4, MOHANAM_NOTES.E4, MOHANAM_NOTES.D4, MOHANAM_NOTES.C4,
    MOHANAM_NOTES.E4, MOHANAM_NOTES.G4, MOHANAM_NOTES.C5, MOHANAM_NOTES.D5,
    MOHANAM_NOTES.C5, MOHANAM_NOTES.A4, MOHANAM_NOTES.G4, MOHANAM_NOTES.E4
  ];

  /**
   * Syncopated Kudla rhythm bass sequence.
   */
  const MAIN_BASS_NOTES = [
    MOHANAM_NOTES.C3, 0, MOHANAM_NOTES.G3, 0,
    MOHANAM_NOTES.C3, 0, MOHANAM_NOTES.E3, 0,
    MOHANAM_NOTES.A3, 0, MOHANAM_NOTES.E3, 0,
    MOHANAM_NOTES.G3, 0, MOHANAM_NOTES.D3, 0
  ];

  /**
   * Star mode high-speed arpeggio sequence.
   */
  const STAR_LEAD_NOTES = [
    MOHANAM_NOTES.C5, MOHANAM_NOTES.E5, MOHANAM_NOTES.G5, MOHANAM_NOTES.A5,
    MOHANAM_NOTES.C6, MOHANAM_NOTES.A5, MOHANAM_NOTES.G5, MOHANAM_NOTES.E5
  ];

  /**
   * Safely reads localStorage item.
   * @param {string} key
   * @return {?string}
   */
  function safeStorageGet(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      // Sandboxed iframe safety
    }
    return null;
  }

  /**
   * Safely writes localStorage item.
   * @param {string} key
   * @param {string} value
   */
  function safeStorageSet(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      // Sandboxed iframe safety
    }
  }

  /**
   * Generates or retrieves a 1-second white noise buffer.
   * @return {?AudioBuffer}
   */
  function getNoiseBuffer() {
    if (cachedNoiseBuffer) {
      return cachedNoiseBuffer;
    }
    if (!audioContext) {
      return null;
    }
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, sampleRate, sampleRate);
    const output = buffer.getChannelData(0);
    for (let index = 0; index < sampleRate; index += 1) {
      output[index] = Math.random() * 2 - 1;
    }
    cachedNoiseBuffer = buffer;
    return buffer;
  }

  /**
   * Lookahead scheduler callback (runs roughly every 25ms).
   */
  function scheduleMusicNotes() {
    if (!audioContext || activeMusicMode === 'none') {
      return;
    }

    const scheduleAheadTime = 0.1; // 100ms lookahead
    let bpm = 140;
    if (activeMusicMode === 'hurry') {
      bpm = 175; // 1.25x speed
    } else if (activeMusicMode === 'star') {
      bpm = 160;
    }

    // 16th note step duration in seconds
    const stepDuration = (60 / bpm) / 4;

    while (nextMusicNoteTime < audioContext.currentTime + scheduleAheadTime) {
      playMusicStep(nextMusicNoteTime, stepDuration);
      nextMusicNoteTime += stepDuration;
      musicStepIndex += 1;
    }
  }

  /**
   * Synthesizes one step of the music loop at the scheduled time.
   * @param {number} scheduledTime
   * @param {number} stepDuration
   */
  function playMusicStep(scheduledTime, stepDuration) {
    if (!audioContext || !musicGain) {
      return;
    }

    if (activeMusicMode === 'star') {
      // Star powerup: bright sparkling arpeggios
      const noteFreq = STAR_LEAD_NOTES[musicStepIndex % STAR_LEAD_NOTES.length];
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(noteFreq, scheduledTime);

      gain.gain.setValueAtTime(0.0001, scheduledTime);
      gain.gain.linearRampToValueAtTime(0.2, scheduledTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + stepDuration * 0.9);

      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(scheduledTime);
      osc.stop(scheduledTime + stepDuration);
      return;
    }

    // Main / Hurry mode: Lead, Bass, and Percussion
    const step = musicStepIndex % 16;

    // Lead melody (square wave with gentle warm lowpass)
    const leadFreq = MAIN_LEAD_NOTES[step];
    if (leadFreq > 0) {
      const leadOsc = audioContext.createOscillator();
      const leadFilter = audioContext.createBiquadFilter();
      const leadGain = audioContext.createGain();

      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(leadFreq, scheduledTime);

      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(1600, scheduledTime);

      leadGain.gain.setValueAtTime(0.0001, scheduledTime);
      leadGain.gain.linearRampToValueAtTime(0.12, scheduledTime + 0.01);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + stepDuration * 0.85);

      leadOsc.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(musicGain);
      leadOsc.start(scheduledTime);
      leadOsc.stop(scheduledTime + stepDuration);
    }

    // Bass line (triangle wave)
    const bassFreq = MAIN_BASS_NOTES[step];
    if (bassFreq > 0) {
      const bassOsc = audioContext.createOscillator();
      const bassGain = audioContext.createGain();

      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassFreq, scheduledTime);

      bassGain.gain.setValueAtTime(0.0001, scheduledTime);
      bassGain.gain.linearRampToValueAtTime(0.28, scheduledTime + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + stepDuration * 1.8);

      bassOsc.connect(bassGain);
      bassGain.connect(musicGain);
      bassOsc.start(scheduledTime);
      bassOsc.stop(scheduledTime + stepDuration * 1.9);
    }

    // Noise tabla percussion
    const noiseBuffer = getNoiseBuffer();
    if (noiseBuffer) {
      if (step === 0 || step === 4 || step === 8 || step === 12) {
        // Low bayan dagga stroke (sine bend 110Hz -> 50Hz)
        const bayanOsc = audioContext.createOscillator();
        const bayanGain = audioContext.createGain();
        bayanOsc.type = 'sine';
        bayanOsc.frequency.setValueAtTime(110, scheduledTime);
        bayanOsc.frequency.exponentialRampToValueAtTime(50, scheduledTime + 0.12);

        bayanGain.gain.setValueAtTime(0.0001, scheduledTime);
        bayanGain.gain.linearRampToValueAtTime(0.25, scheduledTime + 0.01);
        bayanGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + 0.14);

        bayanOsc.connect(bayanGain);
        bayanGain.connect(musicGain);
        bayanOsc.start(scheduledTime);
        bayanOsc.stop(scheduledTime + 0.15);
      } else if (step === 2 || step === 6 || step === 10 || step === 14) {
        // Dhayan sharp rim tap (filtered noise burst)
        const noiseNode = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const tapGain = audioContext.createGain();

        noiseNode.buffer = noiseBuffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(550, scheduledTime);
        filter.Q.setValueAtTime(4.0, scheduledTime);

        tapGain.gain.setValueAtTime(0.0001, scheduledTime);
        tapGain.gain.linearRampToValueAtTime(0.18, scheduledTime + 0.005);
        tapGain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + 0.06);

        noiseNode.connect(filter);
        filter.connect(tapGain);
        tapGain.connect(musicGain);
        noiseNode.start(scheduledTime);
        noiseNode.stop(scheduledTime + 0.07);
      }
    }
  }

  const Audio = {
    /**
     * Initializes the Web Audio context and audio buses upon user interaction.
     */
    init: function () {
      if (typeof window === 'undefined') {
        return;
      }
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        return;
      }

      if (!audioContext) {
        audioContext = new AudioCtxClass();

        // Master Gain
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);

        // Music Gain (0.35 per spec)
        musicGain = audioContext.createGain();
        musicGain.gain.setValueAtTime(0.35, audioContext.currentTime);
        musicGain.connect(masterGain);

        // SFX Gain (0.75)
        sfxGain = audioContext.createGain();
        sfxGain.gain.setValueAtTime(0.75, audioContext.currentTime);
        sfxGain.connect(masterGain);

        // Continuous Rumble Bus
        rumbleGain = audioContext.createGain();
        rumbleGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        rumbleGain.connect(masterGain);

        // Set up continuous low rumble oscillator
        const rumbleFilter = audioContext.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(48, audioContext.currentTime);

        const noiseBuffer = getNoiseBuffer();
        if (noiseBuffer) {
          rumbleSource = audioContext.createBufferSource();
          rumbleSource.buffer = noiseBuffer;
          rumbleSource.loop = true;
          rumbleSource.connect(rumbleFilter);
          rumbleFilter.connect(rumbleGain);
          rumbleSource.start(0);
        }

        // Restore muted preference
        const storageKeys = (KUDLA.Config && KUDLA.Config.STORAGE_KEYS) || {};
        const savedMute = safeStorageGet(storageKeys.MUTED || 'kudla.muted');
        if (savedMute !== null) {
          Audio.setMuted(savedMute === 'true');
        }
      }

      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
    },

    /**
     * Synthesizes and plays a named sound effect.
     * @param {string} name
     */
    play: function (name) {
      if (!audioContext || isMutedState || !sfxGain) {
        return;
      }
      const now = audioContext.currentTime;

      if (name === 'jump') {
        // Small jump: upward pitch sweep (160 Hz -> 380 Hz)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.11);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (name === 'bigjump') {
        // Big jump: deeper resonant sweep (130 Hz -> 520 Hz)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.16);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (name === 'cashew') {
        // Golden cashew chime: dual bright high bell (B5 987 Hz + E6 1318 Hz)
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now);
        osc2.frequency.setValueAtTime(1318.51, now + 0.04);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(sfxGain);
        osc1.start(now);
        osc2.start(now + 0.04);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);
      } else if (name === 'bump') {
        // Tile bump thud (180 Hz -> 50 Hz drop)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.07);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (name === 'break') {
        // Tile break shatter: noisy snap + pitch drop
        const noise = getNoiseBuffer();
        if (noise) {
          const noiseSrc = audioContext.createBufferSource();
          const filter = audioContext.createBiquadFilter();
          const gain = audioContext.createGain();
          noiseSrc.buffer = noise;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(900, now);
          filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
          noiseSrc.connect(filter);
          filter.connect(gain);
          gain.connect(sfxGain);
          noiseSrc.start(now);
          noiseSrc.stop(now + 0.17);
        }
      } else if (name === 'powerup_appear') {
        // Item emerge trill
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.28);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (name === 'powerup') {
        // Collect powerup: ascending 4-note Mohanam arpeggio (C4-E4-G4-C5)
        const notes = [261.63, 329.63, 392.00, 523.25];
        for (let index = 0; index < notes.length; index += 1) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startTime = now + index * 0.07;
          osc.type = 'square';
          osc.frequency.setValueAtTime(notes[index], startTime);
          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
          osc.connect(gain);
          gain.connect(sfxGain);
          osc.start(startTime);
          osc.stop(startTime + 0.2);
        }
      } else if (name === 'oneup') {
        // 1-Up fanfare: bright ascending bell (G4-C5-E5-G5-C6)
        const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
        for (let index = 0; index < notes.length; index += 1) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startTime = now + index * 0.06;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[index], startTime);
          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.linearRampToValueAtTime(0.22, startTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);
          osc.connect(gain);
          gain.connect(sfxGain);
          osc.start(startTime);
          osc.stop(startTime + 0.27);
        }
      } else if (name === 'stomp') {
        // Stomp pop: 260 Hz -> 40 Hz
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (name === 'kick') {
        // Enemy kick: punchy impact (180 Hz -> 35 Hz)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.11);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (name === 'fireball') {
        // Chilli fireball throw: airy spit
        const noise = getNoiseBuffer();
        if (noise) {
          const noiseSrc = audioContext.createBufferSource();
          const filter = audioContext.createBiquadFilter();
          const gain = audioContext.createGain();
          noiseSrc.buffer = noise;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1400, now);
          filter.frequency.exponentialRampToValueAtTime(300, now + 0.1);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
          noiseSrc.connect(filter);
          filter.connect(gain);
          gain.connect(sfxGain);
          noiseSrc.start(now);
          noiseSrc.stop(now + 0.12);
        }
      } else if (name === 'hurt') {
        // Player hurt: distressing buzz (360 Hz -> 120 Hz)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.22);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (name === 'die') {
        // Player die: sorrowful downward slide (460 Hz -> 70 Hz over 1.6s)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 1.6);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 1.85);
      } else if (name === 'flag') {
        // Flag slide & fanfare (E5, G5, C6 chord)
        const chord = [659.25, 783.99, 1046.50];
        for (let index = 0; index < chord.length; index += 1) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(chord[index], now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
          osc.connect(gain);
          gain.connect(sfxGain);
          osc.start(now);
          osc.stop(now + 0.75);
        }
      } else if (name === 'clear') {
        // Level clear victory chord (C4, E4, G4, A4, C5)
        const chord = [261.63, 329.63, 392.00, 440.00, 523.25];
        for (let index = 0; index < chord.length; index += 1) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(chord[index], now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
          osc.connect(gain);
          gain.connect(sfxGain);
          osc.start(now);
          osc.stop(now + 1.5);
        }
      } else if (name === 'horn') {
        // Two-tone locomotive horn per spec (about 311 Hz and 392 Hz, low-passed, 1.3 s)
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(311.13, now); // Eb4
        osc2.frequency.setValueAtTime(392.00, now); // G4

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.38, now + 0.08); // realistic attack
        gain.gain.setValueAtTime(0.38, now + 1.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3); // release

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.32);
        osc2.stop(now + 1.32);
      } else if (name === 'pause') {
        // Short digital blip (659 Hz -> 880 Hz)
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880.00, now + 0.05);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (name === 'hurry') {
        // Urgent hurry alert pulses
        for (let index = 0; index < 3; index += 1) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startTime = now + index * 0.09;
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, startTime);
          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.07);
          osc.connect(gain);
          gain.connect(sfxGain);
          osc.start(startTime);
          osc.stop(startTime + 0.08);
        }
      } else if (name === 'chime') {
        // Original station bell chime per spec: E5, C5, G4
        const bellNotes = [659.25, 523.25, 392.00];
        for (let index = 0; index < bellNotes.length; index += 1) {
          const osc = audioContext.createOscillator();
          const overtone = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startTime = now + index * 0.18;

          osc.type = 'sine';
          overtone.type = 'sine';
          osc.frequency.setValueAtTime(bellNotes[index], startTime);
          overtone.frequency.setValueAtTime(bellNotes[index] * 2.76, startTime); // tubular bell overtone

          gain.gain.setValueAtTime(0.0001, startTime);
          gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.7);

          osc.connect(gain);
          overtone.connect(gain);
          gain.connect(sfxGain);

          osc.start(startTime);
          overtone.start(startTime);
          osc.stop(startTime + 0.75);
          overtone.stop(startTime + 0.75);
        }
      } else if (name === 'tick') {
        // Crisp clock / score tally tick (0.015s noise click)
        const noise = getNoiseBuffer();
        if (noise) {
          const noiseSrc = audioContext.createBufferSource();
          const filter = audioContext.createBiquadFilter();
          const gain = audioContext.createGain();
          noiseSrc.buffer = noise;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1400, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
          noiseSrc.connect(filter);
          filter.connect(gain);
          gain.connect(sfxGain);
          noiseSrc.start(now);
          noiseSrc.stop(now + 0.02);
        }
      }
    },

    /**
     * Starts looping music in the specified mode with crossfade.
     * @param {string} mode 'main'|'hurry'|'star'
     */
    startMusic: function (mode) {
      if (activeMusicMode === mode) {
        return;
      }
      activeMusicMode = mode;
      musicStepIndex = 0;

      if (!audioContext || !musicGain) {
        return;
      }

      // Smooth volume crossfade
      const now = audioContext.currentTime;
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(0.05, now + 0.1);
      musicGain.gain.linearRampToValueAtTime(0.35, now + 0.25);

      nextMusicNoteTime = now + 0.12;

      if (musicTimer === null && typeof window !== 'undefined' && window.setInterval) {
        musicTimer = window.setInterval(scheduleMusicNotes, 25);
      }
    },

    /**
     * Stops the looping background music.
     */
    stopMusic: function () {
      activeMusicMode = 'none';
      if (musicTimer !== null) {
        if (typeof window !== 'undefined' && window.clearInterval) {
          window.clearInterval(musicTimer);
        }
        musicTimer = null;
      }
      if (audioContext && musicGain) {
        const now = audioContext.currentTime;
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.linearRampToValueAtTime
          ? musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.15)
          : musicGain.gain.setValueAtTime(0.0001, now);
      }
    },

    /**
     * Sets mute state and persists it in localStorage.
     * @param {boolean} bool
     */
    setMuted: function (bool) {
      isMutedState = Boolean(bool);
      if (audioContext && masterGain) {
        const now = audioContext.currentTime;
        masterGain.gain.setValueAtTime(isMutedState ? 0.0001 : 1.0, now);
      }
      const storageKeys = (KUDLA.Config && KUDLA.Config.STORAGE_KEYS) || {};
      safeStorageSet(storageKeys.MUTED || 'kudla.muted', String(isMutedState));
    },

    /**
     * Returns true if audio is currently muted.
     * @return {boolean}
     */
    isMuted: function () {
      return isMutedState;
    },

    /**
     * Toggles audio mute state.
     * @return {boolean} New mute state
     */
    toggleMute: function () {
      Audio.setMuted(!isMutedState);
      return isMutedState;
    },

    /**
     * Speaks station announcement via SpeechSynthesis after chime.
     * Prefers en-IN voice.
     * @param {string} text
     */
    announce: function (text) {
      if (!text || isMutedState) {
        return;
      }
      Audio.play('chime');

      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }

      // Schedule speech after chime plays (~0.6s)
      if (window.setTimeout) {
        window.setTimeout(function () {
          try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            utterance.pitch = 1.0;

            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
              for (let index = 0; index < voices.length; index += 1) {
                const voice = voices[index];
                if (voice.lang && voice.lang.indexOf('en-IN') !== -1) {
                  utterance.voice = voice;
                  break;
                }
              }
            }
            window.speechSynthesis.speak(utterance);
          } catch (err) {
            // Speech synthesis failed or permission blocked.
          }
        }, 600);
      }
    },

    /**
     * Sets continuous train rumble intensity (0 to 1).
     * @param {number} intensity
     */
    setRumble: function (intensity) {
      if (!audioContext || !rumbleGain) {
        return;
      }
      const clamped = Math.max(0, Math.min(1, intensity || 0));
      const targetGain = clamped * 0.35;
      const now = audioContext.currentTime;
      rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, now);
      rumbleGain.gain.linearRampToValueAtTime(targetGain, now + 0.1);
    }
  };

  KUDLA.Audio = Audio;
  if (typeof module === 'object' && module.exports) {
    module.exports = Audio;
  }
})(typeof window !== 'undefined' ? window : globalThis);
