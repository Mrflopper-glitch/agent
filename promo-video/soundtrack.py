"""Original 150 BPM soundtrack, synthesised from scratch and locked to the video timeline.

Every hit, whoosh and UI sound is placed by *frame number* (30 fps), so it lands exactly
on the cut it belongs to in index.html. Writes out/soundtrack.wav (48 kHz, stereo).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR, FPS, BPM = 48000, 30, 150
BEAT = 60 / BPM            # 0.4 s = 12 frames
STEP = BEAT / 4            # 16th note = 3 frames
TOTAL = 1056 / FPS         # 35.2 s
N = int(TOTAL * SR)
rng = np.random.default_rng(7)

drums = np.zeros((2, N))
music = np.zeros((2, N))    # sidechain-ducked by the kick
sfx = np.zeros((2, N))
send = np.zeros((2, N))     # reverb send
kicks = []                  # kick times, for the sidechain


def F(f):
    """frame -> seconds"""
    return f / FPS


def Bt(n):
    """beat -> seconds"""
    return n * BEAT


def add(bus, sig, t, gain=1.0, pan=0.0, verb=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    s = sig[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    bus[0, i:i + len(s)] += s * l
    bus[1, i:i + len(s)] += s * r
    if verb:
        send[0, i:i + len(s)] += s * l * verb
        send[1, i:i + len(s)] += s * r * verb


def filt(x, kind, fc, order=2):
    return sosfilt(butter(order, fc, kind, fs=SR, output='sos'), x)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.standard_normal(int(dur * SR))


# --- instruments ---------------------------------------------------------------
def kick(f0=170, f1=44, dur=0.5, drive=1.7):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = filt(noise(dur), 'low', 5000) * np.exp(-t * 400) * .35
    return np.tanh((body + click) * drive) * .85


def clap(dur=.4):
    t = tt(dur)
    nz = filt(noise(dur), 'band', [900, 6000])
    env = sum(np.where(t >= d, np.exp(-np.clip(t - d, 0, None) / tau), 0) for d, tau in [(0, .005), (.012, .005), (.024, .11)])
    return nz * env * .55


def snare(dur=.22):
    t = tt(dur)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * .5
    nz = filt(noise(dur), 'high', 1800) * np.exp(-t * 22) * .6
    return tone + nz


def hat(open_=False):
    dur = .2 if open_ else .05
    t = tt(dur)
    return filt(noise(dur), 'high', 7500) * np.exp(-t / (.07 if open_ else .012)) * .5


def crash(dur=2.2):
    t = tt(dur)
    nz = filt(noise(dur), 'high', 3500) * np.exp(-t / .55)
    metal = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in [3150, 4390, 5870, 7240]) * .05 * np.exp(-t / .4)
    return (nz * .45 + metal)


def impact(dur=1.6, f0=95, f1=27, nz_gain=.6):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .5)
    nz = filt(noise(dur), 'low', 1400) * np.exp(-t / .12) * nz_gain
    return np.tanh((sub + nz) * 2.2) * .8


def saw(freq, t, phase=0.0):
    return 2 * ((t * freq + phase) % 1) - 1


def sub808(freq, dur, glide=None):
    t = tt(dur)
    f = np.full_like(t, freq) if glide is None else freq + (glide - freq) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / .004) * np.exp(-t / (dur * .9))
    rel = np.clip((dur - t) / .03, 0, 1)
    return np.tanh(s * 2.0) * env * rel * .75


def pad(freqs, dur, cutoff=1100):
    t = tt(dur)
    s = sum(saw(f * d, t, rng.uniform()) for f in freqs for d in (0.996, 1.0, 1.004)) / (3 * len(freqs))
    env = np.minimum(1, t / .35) * np.clip((dur - t) / .25, 0, 1)
    return filt(s, 'low', cutoff) * env


def pluck(freq, dur=.2, bright=3200):
    t = tt(dur)
    s = .6 * saw(freq, t) + .4 * np.sign(np.sin(2 * np.pi * freq * t))
    s = filt(s, 'low', bright)
    return s * np.exp(-t / .07) * np.minimum(1, t / .002)


def riser(dur, f0=180, f1=2400):
    t = tt(dur)
    p = t / dur
    f = f0 * (f1 / f0) ** (p ** 1.6)
    tone = (saw(1, np.cumsum(f) / SR) * .3 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .3)
    nz = filt(noise(dur), 'high', 2000) * .5
    return filt(tone, 'low', 5000) * p ** 2 + nz * p ** 2.6


def whoosh(dur=.42, up=True):
    t = tt(dur)
    p = t / dur
    nz = noise(dur)
    bands = [(300, 900), (700, 2000), (1500, 4500), (3000, 9000)]
    out = np.zeros_like(nz)
    for k, (lo, hi) in enumerate(bands):
        c = k / (len(bands) - 1)
        c = c if up else 1 - c
        w = np.exp(-((p - (.2 + .6 * c)) ** 2) / .03)
        out += filt(nz, 'band', [lo, hi]) * w
    return out * np.sin(np.pi * p) ** 2 * .7


def tick(f=2600, dur=.03, g=1.0):
    t = tt(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / .006) * g


def chime(freqs, dur=1.0, tau=.3):
    t = tt(dur)
    s = sum(np.sin(2 * np.pi * f * t) * (.8 ** k) + .25 * np.sin(2 * np.pi * f * 2.01 * t) * (.8 ** k) for k, f in enumerate(freqs))
    return s * np.exp(-t / tau) * np.minimum(1, t / .003) / len(freqs)


def zip_up(dur=.33):
    t = tt(dur)
    f = 380 * (5.0 ** (t / dur))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .5 + filt(noise(dur), 'band', [2000, 7000]) * .25
    return s * np.minimum(1, t / .02) * (t / dur) ** .5


def glitch(dur=.09):
    t = tt(dur)
    s = np.sign(np.sin(2 * np.pi * 220 * t * (1 + 8 * t))) * .3 + filt(noise(dur), 'band', [1000, 8000]) * .5
    s = np.round(s * 4) / 4
    return s * np.exp(-t / .03)


# --- harmony ---------------------------------------------------------------------
def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


CHORDS = {  # root midi (bass), pad voicing
    'Am': (33, [57, 60, 64, 69]), 'F': (29, [53, 57, 60, 65]),
    'C': (36, [55, 60, 64, 67]), 'G': (31, [55, 59, 62, 67]), 'E': (28, [56, 59, 64, 68]),
}
PROG = ['Am', 'F', 'C', 'G']
ARP = [0, 7, 12, 7, 3, 7, 15, 12, 0, 7, 12, 19, 15, 12, 7, 3]   # semitone offsets from chord root (minor)


def bar_chord(bar):
    return PROG[bar % 4]


# --- arrangement -----------------------------------------------------------------
# Bars are 1.6 s (48 frames). Bar 0 = slams, bars 1-3 = tension, drop at bar 4 (beat 16).
def kick_at(t, g=1.0, **kw):
    add(drums, kick(**kw), t, g)
    kicks.append(t)


# Intro slams: MARKETS / MOVE / FAST.  (frames 0, 12, 24)
for i, f in enumerate([0, 12, 24]):
    kick_at(F(f), 1.0, f0=200, f1=40)
    add(drums, impact(dur=.9, f0=120, f1=35, nz_gain=.9), F(f), .55, verb=.25)
    add(sfx, glitch(), F(f), .35, pan=(-.4, .4, 0)[i])
add(drums, crash(1.2), F(24), .35, verb=.3)
add(music, pad([hz(m) for m in CHORDS['Am'][1]], 6.6, 700), 0, .22, verb=.4)

# Tension groove (bars 1-3): half-time
for bar in range(1, 4):
    t0 = bar * 4 * BEAT
    ch = ['Am', 'F', 'E'][bar - 1]
    for st in (0, 10):
        if not (bar == 3 and st == 10):
            kick_at(t0 + st * STEP, .85)
    add(drums, clap(), t0 + 8 * STEP, .55, verb=.35)
    for st in range(0, 16, 2):
        add(drums, hat(), t0 + st * STEP, .16 if st % 4 else .22, pan=.25)
    add(music, sub808(hz(CHORDS[ch][0]), 1.55), t0, .55)
# clock ticks under the 10+ hrs stat (frames 96-143)
for k in range(8):
    add(sfx, tick(1800 if k % 2 else 2400, .04), F(96) + k * BEAT / 2, .35, pan=(-.3 if k % 2 else .3))
for k in range(11):   # counter 0 -> 10
    add(sfx, tick(3000, .02), F(96 + k * 1.5), .18)
# riser + snare roll into the drop
add(sfx, riser(Bt(4) + .05), Bt(12), .42)
for k in range(8):
    add(drums, snare(), Bt(14) + k * STEP, .12 + .05 * k)
for k in range(8):
    add(drums, snare(), Bt(15) + k * STEP / 2, .3 + .05 * k)

# THE DROP (beat 16, frame 192)
add(drums, impact(), Bt(16), .95, verb=.35)
add(drums, crash(), Bt(16), .5, verb=.3)
add(drums, impact(dur=1.0, f0=110, f1=40), Bt(18), .5, verb=.2)   # LIVE.


def groove(bar, four_floor=False, arp=True, hats=True, bass=True, stab=False):
    t0 = bar * 4 * BEAT
    ch = bar_chord(bar)
    root, voicing = CHORDS[ch]
    for st in ((0, 4, 8, 12) if four_floor else (0, 7, 10)):
        kick_at(t0 + st * STEP, .9)
    for st in (4, 12):
        add(drums, clap(), t0 + st * STEP, .5, verb=.3)
        add(drums, snare(), t0 + st * STEP, .18)
    if hats:
        for st in range(16):
            add(drums, hat(), t0 + st * STEP, (.17, .07, .11, .07)[st % 4], pan=.3)
        for st in (6, 14):
            add(drums, hat(True), t0 + st * STEP, .12, pan=-.25)
        if bar % 2:
            for k in range(6):   # triplet roll into the next bar
                add(drums, hat(), t0 + 14 * STEP + k * STEP * 2 / 3, .08 + .02 * k, pan=.3)
    if bass:
        add(music, sub808(hz(root), 7 * STEP), t0, .8)
        add(music, sub808(hz(root + 12), 3 * STEP, glide=hz(root)), t0 + 7 * STEP, .5)
        add(music, sub808(hz(root), 6 * STEP), t0 + 10 * STEP, .75)
    add(music, pad([hz(m) for m in voicing], 4 * BEAT, 1600), t0, .2, verb=.35)
    if arp:
        minor = ch in ('Am',)
        for st in range(16):
            off = ARP[st]
            if not minor and off in (3, 15):
                off += 1   # major third on F / C / G
            add(music, pluck(hz(root + 36 + off)), t0 + st * STEP, .12, pan=(-.35 if st % 2 else .35), verb=.2)
    if stab:
        add(music, pad([hz(m + 12) for m in voicing], .25, 4000), t0, .35, verb=.3)


for bar in range(4, 16):        # beats 16-63: feature montage
    groove(bar, arp=bar >= 6, stab=bar in (4, 5))

# breakdown (bar 16, beats 64-67): drums thin out, riser into the climax
groove(16, arp=True, hats=False, bass=False)
add(sfx, riser(Bt(4)), Bt(64), .45)
for k in range(16):
    add(drums, snare(), Bt(66) + k * STEP / 2, .08 + .025 * k)

# climax (bars 17-18): SEE IT. / FOLLOW IT. / MIRROR IT. / number strobe
for bar in (17, 18):
    groove(bar, four_floor=True, arp=True)
for b in (68, 70, 72):
    add(drums, impact(dur=1.0, f0=120, f1=38), Bt(b), .6, verb=.25)
    add(drums, crash(1.2), Bt(b), .3, verb=.25)
    add(sfx, glitch(), Bt(b), .3)
for k, f in enumerate([888, 894, 900, 906]):
    add(drums, impact(dur=.25, f0=140 + 30 * k, f1=60), F(f), .5)
    add(sfx, glitch(.06), F(f), .25, pan=(-.5, .5, -.3, .3)[k])

# END CARD (beat 76, frame 912): the big one, then ring out
add(drums, impact(dur=2.6, f0=90, f1=24), Bt(76), 1.0, verb=.45)
add(drums, crash(3.0), Bt(76), .55, verb=.4)
add(music, pad([hz(m) for m in CHORDS['Am'][1]] + [hz(76)], 4.8, 2200), Bt(76), .32, verb=.6)
add(music, sub808(hz(33), 2.4), Bt(76), .6)
add(sfx, chime([hz(81), hz(88), hz(93)], 2.5, .6), F(915), .38, verb=.5)   # mark draws in
add(sfx, chime([hz(76), hz(81)], .6, .12), F(954), .25, verb=.3)            # CTA pops
add(sfx, whoosh(.7), F(978), .22, pan=-.2)                                # shine sweep

# --- scene SFX (frame-locked) --------------------------------------------------------
for f, up in [(236, True), (284, False), (380, True), (476, False), (572, False), (668, True), (764, True)]:
    add(sfx, whoosh(.42, up), F(f), .5, pan=(.3 if up else -.3))
for i in range(5):                                       # s6 feed rows
    add(sfx, tick(2200 + 180 * i, .03), F(248 + 3 * i), .22, pan=.4)
for f in (304, 308):                                     # s7 chips
    add(sfx, tick(1500, .05), F(f), .25)
add(sfx, tick(1200, .04), F(336), .5)                    # s7 tap Follow
add(sfx, chime([hz(88), hz(93)], .5, .1), F(338), .3, verb=.2)
for k in range(15):                                      # s8 value counter
    add(sfx, tick(3200, .015), F(386 + 2 * k), .14 * (1 - k / 18))
for i in range(5):                                       # s8 holdings
    add(sfx, tick(2000 + 200 * i, .03), F(436 + 3 * i), .2, pan=.4)
add(sfx, tick(1500, .05), F(444), .25)
add(sfx, chime([hz(84), hz(91)], .8, .18), F(484), .4, verb=.3)   # s9 notification ding
add(sfx, whoosh(.3, True), F(498), .3)
for i in range(7):                                       # s9 cascade
    add(sfx, tick(1900 + 150 * i, .03), F(502 + 3 * i), .22, pan=.4)
add(sfx, whoosh(.3, True), F(576), .3)                   # s10 sheet up
for k in range(10):
    add(sfx, tick(2800 + 60 * k, .015), F(588 + 2 * k), .13)
add(sfx, zip_up(), F(622), .35)                          # swipe
add(sfx, chime([hz(81), hz(85), hz(88), hz(93)], 1.0, .25), F(632), .42, verb=.35)  # mirrored
add(sfx, tick(1500, .05), F(636), .25)
add(sfx, whoosh(.25, False), F(692), .35)                # s11 strike
add(drums, impact(dur=1.0, f0=120, f1=40), F(708), .6, verb=.25)   # 10 min slam
add(sfx, glitch(), F(708), .25)

# --- mix -------------------------------------------------------------------------------
t = np.arange(N) / SR
duck = np.ones(N)
for k in kicks:
    i = int(k * SR)
    seg = t[i:i + int(.3 * SR)] - k
    duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], 1 - .55 * np.exp(-seg / .09))
music *= duck

ir_t = np.arange(int(2.2 * SR)) / SR
ir = np.stack([filt(rng.standard_normal(len(ir_t)), 'low', 6500) * np.exp(-ir_t / .45) for _ in range(2)])
ir /= np.abs(ir).sum(axis=1, keepdims=True) / 40
wet = np.stack([fftconvolve(send[c], ir[c])[:N] for c in range(2)]) * .25

mixed = drums * .9 + music * .8 + sfx * .9 + wet
mixed = np.stack([filt(mixed[c], 'high', 28) for c in range(2)])   # clean up sub rumble
fade = np.clip((TOTAL - t) / .35, 0, 1)                              # last ~10 frames
mixed *= fade
mixed /= np.max(np.abs(mixed)) / 1.25
mixed = np.tanh(mixed) / np.tanh(1.25) * .93                         # soft limiter, ~-0.6 dBFS peak

os.makedirs('out', exist_ok=True)
pcm = (np.clip(mixed.T, -1, 1) * 32767).astype('<i2')
with wave.open('out/soundtrack.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'wrote out/soundtrack.wav  {TOTAL:.1f}s  peak {np.max(np.abs(mixed)):.3f}')
