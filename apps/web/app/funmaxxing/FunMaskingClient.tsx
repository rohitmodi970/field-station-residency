'use client';

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { COUNTRIES, Country, detectCountry, formatPhoneNumber, validatePhoneNumber } from './countries';
import { SpotlightCursor } from './SpotlightCursor';

interface FormState {
  name: string;
  email: string;
  thought: string;
  contribution: string;
  phone: string;
  source: string;
  referralCode?: string;
  referredBy?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const plateStates = [
  { no: '00', distance: 'd = 1.00', separation: 0.64 },
  { no: '01', distance: 'd = 0.72', separation: 0.50 },
  { no: '02', distance: 'd = 0.46', separation: 0.34 },
  { no: '03', distance: 'd = 0.24', separation: 0.22 },
  { no: '04', distance: 'd = 0.14', separation: 0.14 },
  { no: '05', distance: 'd = 0.06', separation: 0.06 },
  { no: '06', distance: 'd = 0.02', separation: 0.022 },
];

function ForceLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round((size * 150) / 198)}
      viewBox="4 2 198 150"
      fill="currentColor"
      className="text-[#c98a72] shrink-0 block"
      aria-hidden="true"
    >
      <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8529 33.1043 85.3772 32.024Z" />
      <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1043 120.579 32.024Z" />
      <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" />
      <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" />
    </svg>
  );
}



/**
 * Field plate: iron filings dipole simulation between two bodies.
 * Exactly implements the dipole physics, jittered grid, and spring motion from the reference design.
 */
function FieldCanvas({ separation, isMet = false, label }: { separation: number; isMet?: boolean; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  const sepRef = useRef(separation);
  const targetRef = useRef(separation);
  const velRef = useRef(0);
  const isMetRef = useRef(isMet);
  const metTRef = useRef(0);
  const labelRef = useRef(label);
  const reducedMotionRef = useRef(Boolean(reducedMotion));

  useEffect(() => {
    targetRef.current = separation;
  }, [separation]);

  useEffect(() => {
    if (isMet && !isMetRef.current) {
      metTRef.current = performance.now();
    }
    isMetRef.current = isMet;
  }, [isMet]);

  useEffect(() => {
    labelRef.current = (label.trim().split(/\s+/)[0] || 'you').toLowerCase();
  }, [label]);

  useEffect(() => {
    reducedMotionRef.current = Boolean(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let pts: [number, number, number][] = [];
    let animationFrameId = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      if (W === 0 || H === 0) return;
      const reduce = reducedMotionRef.current;
      const t = (now - t0) / 1000;
      context.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H * 0.5;
      const breathe = reduce ? 0 : Math.sin(t * 0.6) * 0.006;
      const sep = sepRef.current;
      const half = Math.max(0.012, sep + breathe) * W / 2;
      const ax = cx - half;
      const bx = cx + half;
      const soft = Math.max(18, W * 0.02);
      const L = W < 500 ? 5 : 6.5;

      const buckets: Path2D[] = [
        new Path2D(),
        new Path2D(),
        new Path2D(),
        new Path2D(),
        new Path2D(),
      ];
      const merged = sep < 0.1;
      const clear = (x: number, y: number) => {
        const near = (px: number) => (x - px) ** 2 + (y - cy) ** 2 < 12 ** 2;
        const tag = (px: number, w: number) =>
          Math.abs(x - px) < w && y > cy + 10 && y < cy + 28;
        return (
          near(ax) ||
          near(bx) ||
          (merged ? tag(cx, 52) : tag(ax, 30) || tag(bx, 48))
        );
      };

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (!pt) continue;
        const [x, y, k] = pt;
        if (clear(x, y)) continue;

        // dipole: +1 at a, −1 at b. Lines run between the two bodies.
        let dx = x - ax;
        let dy = y - cy;
        let r2 = dx * dx + dy * dy + soft * soft;
        let r3 = r2 * Math.sqrt(r2);
        let ex = dx / r3;
        let ey = dy / r3;

        dx = x - bx;
        dy = y - cy;
        r2 = dx * dx + dy * dy + soft * soft;
        r3 = r2 * Math.sqrt(r2);
        ex -= dx / r3;
        ey -= dy / r3;

        const m = Math.hypot(ex, ey);
        if (!m) continue;

        const s = Math.min(1, Math.log10(1 + m * W * W * 0.9) / 2.2);
        const b = Math.min(4, Math.floor(s * 5));
        const ux = (ex / m) * L * k * 0.5;
        const uy = (ey / m) * L * k * 0.5;
        buckets[b]!.moveTo(x - ux, y - uy);
        buckets[b]!.lineTo(x + ux, y + uy);
      }

      context.lineCap = 'round';
      context.lineWidth = 1;
      const alphas = [0.04, 0.1, 0.18, 0.3, 0.48];
      for (let i = 0; i < 5; i++) {
        context.strokeStyle = `rgba(236,230,219,${alphas[i]})`;
        context.stroke(buckets[i]!);
      }

      // bodies
      const r = W < 500 ? 4 : 5;
      context.fillStyle = '#ece6db';
      context.beginPath();
      context.arc(ax, cy, r, 0, Math.PI * 2);
      context.fill();

      const met = isMetRef.current;
      const metT = metTRef.current;
      const mt = met ? Math.min(1, (now - metT) / 700) : 0;

      context.fillStyle = mt
        ? `rgb(${Math.round(236 + (201 - 236) * mt)},${Math.round(230 + (138 - 230) * mt)},${Math.round(219 + (114 - 219) * mt)})`
        : '#ece6db';
      context.beginPath();
      context.arc(bx, cy, r, 0, Math.PI * 2);
      context.fill();

      if (met) {
        context.fillStyle = `rgba(201,138,114,${mt})`;
        context.beginPath();
        context.arc(ax, cy, r, 0, Math.PI * 2);
        context.fill();
      }

      // labels
      context.font = `11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif`;
      context.textAlign = 'center';
      const la = 1 - Math.min(1, Math.max(0, (0.1 - sep) / 0.06));
      const currentLabel = labelRef.current || 'you';

      context.fillStyle = `rgba(236,230,219,${0.55 * la})`;
      context.fillText(currentLabel, ax, cy + 22);
      context.fillText('your inner self', bx, cy + 22);

      if (la < 1) {
        context.fillStyle = `rgba(236,230,219,${0.55 * (1 - la)})`;
        context.fillText(`${currentLabel}, known`, cx, cy + 22);
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = bounds.width;
      H = bounds.height;
      if (W === 0 || H === 0) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // jittered grid of filings
      pts = [];
      const g = W < 500 ? 9 : 11;
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let y = g / 2; y < H; y += g) {
        for (let x = g / 2; x < W; x += g) {
          pts.push([
            x + (rnd() - 0.5) * g * 0.9,
            y + (rnd() - 0.5) * g * 0.9,
            0.7 + rnd() * 0.6,
          ]);
        }
      }
      draw(performance.now());
    };

    const tick = (now: number) => {
      const reduce = reducedMotionRef.current;
      if (reduce) {
        sepRef.current = targetRef.current;
      } else {
        const dt = 1 / 60;
        const k = 26;
        const c = 2 * Math.sqrt(k);
        velRef.current += (-(sepRef.current - targetRef.current) * k - velRef.current * c) * dt;
        sepRef.current += velRef.current * dt;
      }
      draw(now);
      animationFrameId = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full block pointer-events-none"
      aria-label={`Field between ${label} and your inner self`}
      role="img"
    />
  );
}

/**
 * Member plate: unique seeded plate for the member card.
 */
function CardCanvas({ seedStr }: { seedStr: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = r.width;
    const H = r.height;
    if (W === 0 || H === 0) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let seed = 1;
    for (const c of seedStr) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647 || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const theta = (rnd() - 0.5) * 1.4;
    const cx = W * (0.42 + rnd() * 0.16);
    const cy = H * (0.44 + rnd() * 0.12);
    const half = W * 0.03;
    const ax = cx - Math.cos(theta) * half;
    const ay = cy - Math.sin(theta) * half;
    const bx = cx + Math.cos(theta) * half;
    const by = cy + Math.sin(theta) * half;
    const soft = 10;
    const g = 7;
    const L = 4.5;
    const buckets: Path2D[] = [
      new Path2D(),
      new Path2D(),
      new Path2D(),
      new Path2D(),
      new Path2D(),
    ];

    for (let y = g / 2; y < H; y += g) {
      for (let x = g / 2; x < W; x += g) {
        const px = x + (rnd() - 0.5) * g * 0.9;
        const py = y + (rnd() - 0.5) * g * 0.9;
        if ((px - cx) ** 2 + (py - cy) ** 2 < 14 ** 2) continue;
        let dx = px - ax;
        let dy = py - ay;
        let r2 = dx * dx + dy * dy + soft * soft;
        let r3 = r2 * Math.sqrt(r2);
        let ex = dx / r3;
        let ey = dy / r3;
        dx = px - bx;
        dy = py - by;
        r2 = dx * dx + dy * dy + soft * soft;
        r3 = r2 * Math.sqrt(r2);
        ex -= dx / r3;
        ey -= dy / r3;
        const m = Math.hypot(ex, ey);
        if (!m) continue;
        const s = Math.min(1, Math.log10(1 + m * W * W * 0.9) / 2.2);
        const k = (0.7 + rnd() * 0.6) * L * 0.5;
        const ux = (ex / m) * k;
        const uy = (ey / m) * k;
        const b = Math.min(4, Math.floor(s * 5));
        buckets[b]!.moveTo(px - ux, py - uy);
        buckets[b]!.lineTo(px + ux, py + uy);
      }
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    const alphas = [0.05, 0.11, 0.19, 0.3, 0.46];
    alphas.forEach((a, i) => {
      ctx.strokeStyle = `rgba(236,230,219,${a})`;
      ctx.stroke(buckets[i]!);
    });
    ctx.fillStyle = '#c98a72';
    const points: [number, number][] = [[ax, ay], [bx, by]];
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [seedStr]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full block pointer-events-none" aria-hidden="true" />;
}

function memberNumberHash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(100 + (h % 900)).padStart(4, '0');
}

export default function FunMaskingClient() {
  const reduceMotion = useReducedMotion();
  const nameId = useId();
  const emailId = useId();
  const thoughtId = useId();
  const contributionId = useId();
  const phoneId = useId();

  const [step, setStep] = useState<Step>(0);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    thought: '',
    contribution: '',
    phone: '',
    source: '',
    referralCode: '',
    referredBy: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
  });
  const [country, setCountry] = useState<Country>(COUNTRIES[0]!);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberNo, setMemberNo] = useState('0147');
  const [joinedDate, setJoinedDate] = useState('04.10.26');
  const [inviteNo, setInviteNo] = useState('0147');

  useEffect(() => {
    setCountry(detectCountry());
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);

      const getParam = (key: string, storageKey: string) => {
        const urlVal = params.get(key);
        if (urlVal) {
          try {
            sessionStorage.setItem(storageKey, urlVal);
          } catch { }
          return urlVal;
        }
        try {
          return sessionStorage.getItem(storageKey) || '';
        } catch {
          return '';
        }
      };

      const ref = getParam('ref', 'force_ref') || getParam('n', 'force_ref') || getParam('referred_by', 'force_ref');
      const utmSource = getParam('utm_source', 'force_utm_source') || getParam('source', 'force_utm_source');
      const utmMedium = getParam('utm_medium', 'force_utm_medium');
      const utmCampaign = getParam('utm_campaign', 'force_utm_campaign');
      const utmContent = getParam('utm_content', 'force_utm_content');
      const utmTerm = getParam('utm_term', 'force_utm_term');

      setFormData((prev) => ({
        ...prev,
        source: utmSource || prev.source,
        referredBy: ref,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
      }));

      if (ref) setInviteNo(ref);
    }
  }, []);

  const currentPlate = plateStates[step] ?? plateStates[0]!;

  const navigateTo = (nextStep: Step, push = true) => {
    setError('');
    if (push && typeof window !== 'undefined') {
      window.history.pushState({ step: nextStep }, '');
    }
    setStep(nextStep);
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.state && window.history.state.step > 0) {
      window.history.back();
    } else if (step > 0) {
      navigateTo((step - 1) as Step, false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({ step: 0 }, '');
    const handlePopState = (e: PopStateEvent) => {
      const s = e.state?.step;
      if (typeof s === 'number' && s >= 0 && s <= 6) {
        setError('');
        setStep(s as Step);
      } else {
        setStep(0);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1 · Name submit
  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = formData.name.trim();
    if (!v) {
      setError('Just a first name is fine.');
      return;
    }
    setError('');
    navigateTo(2);
  };

  // 2 · Email submit (lead saved here)
  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = formData.email.trim();
    if (!emailPattern.test(v)) {
      setError(v ? 'That email looks off. Mind checking it?' : 'We need somewhere to send your introduction.');
      return;
    }
    setError('');
    navigateTo(3);
  };

  // 3 · Thought submit
  const handleThoughtSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = formData.thought.trim();
    if (v.length < 3) {
      setError('A few words is enough. Or tap one above.');
      return;
    }
    setError('');
    navigateTo(4);
  };

  // 4 · Community contribution submit
  const handleContributionSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = formData.contribution.trim();
    if (v.length < 3) {
      setError('Tell us something that makes people glad you showed up.');
      return;
    }
    setError('');
    navigateTo(5);
  };

  // 5 · Phone submit (joins Force)
  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = formData.phone.trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 15) {
      setError(raw ? 'That number looks off. Check it?' : 'We need a number to text you.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const fullPhone = `${country.dialCode} ${raw}`;
      const memberCode = memberNumberHash(formData.email);
      setMemberNo(memberCode);

      const response = await fetch('/api/fun-masking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: fullPhone,
          countryCode: country.code,
          thought: formData.thought.trim(),
          contribution: formData.contribution.trim(),
          source: formData.source || formData.utmSource || null,
          referralCode: memberCode,
          referredBy: formData.referredBy || null,
          utmSource: formData.utmSource || formData.source || null,
          utmMedium: formData.utmMedium || null,
          utmCampaign: formData.utmCampaign || null,
          utmContent: formData.utmContent || null,
          utmTerm: formData.utmTerm || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(
          result.code === 'DUPLICATE_EMAIL'
            ? 'This email is already in our community pool.'
            : result.error || 'Something slipped. Try once more?'
        );
        return;
      }

      const now = new Date();
      setJoinedDate(
        [
          String(now.getDate()).padStart(2, '0'),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getFullYear() % 100).padStart(2, '0'),
        ].join('.')
      );

      navigateTo(6);
    } catch {
      setError('Something slipped. Try once more?');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Two dots progress calculations
  const progressLabel = step === 0 ? '' : step === 6 ? 'In the pool' : `0${step} / 05`;
  const close = step / 6;
  const span = 64 - 6;
  const dotALeft = (close * span) / 2;
  const dotBLeft = span - (close * span) / 2;
  const isMet = step === 6;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-[#0d0c0b] text-[#ece6db] antialiased selection:bg-[#ece6db] selection:text-[#0d0c0b] font-sans">
        <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Plate (left): the field between two bodies. It closes distance as you progress. */}
          <aside className="relative h-[30vh] min-h-[200px] overflow-hidden border-b border-[#ece6db]/12 bg-[#141210] md:h-auto md:min-h-dvh md:border-b-0 md:border-r" aria-hidden="true">
            <FieldCanvas
              separation={currentPlate.separation}
              isMet={isMet}
              label={formData.name || 'you'}
            />

            <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-center justify-between text-[11px] text-[#ece6db]/38 md:left-7 md:right-7 md:top-6">
              <span className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-[#ece6db]">
                <ForceLogo size={22} />
                Force
              </span>
              <span>
                Pl. <span className="tabular-nums font-mono">{currentPlate.no}</span>
              </span>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-[#ece6db]/38 md:bottom-5.5 md:left-7 md:right-7">
              <span>Field between you and yourself</span>
              <span className="tabular-nums font-mono transition-opacity duration-300">
                {currentPlate.distance}
              </span>
            </div>
          </aside>

          {/* Form (right) */}
          <main className="relative flex min-h-[70vh] flex-col p-4 pb-8 md:min-h-dvh md:p-6 md:px-7 overflow-hidden">
            {/* Custom spotlight cursor: active strictly on the right side, hidden on mobile */}
            <SpotlightCursor config={{ radius: 260, brightness: 0.12, color: '#ece6db', smoothing: 0.12 }} />

            {/* Header with back button & progress indicator */}
            <div className="relative z-10 flex h-10 items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className={`inline-flex items-center gap-1.5 bg-transparent border-0 text-[#ece6db]/62 hover:text-[#ece6db] text-xs cursor-pointer transition-colors duration-150 relative ${step === 0 ? 'invisible pointer-events-none' : 'visible'
                  }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.5 2.5L4 6l3.5 3.5" />
                </svg>
                Back
              </button>

              <div
                className="flex items-center gap-3 text-[11px] text-[#ece6db]/38"
                style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
                aria-live="polite"
              >
                <span className="tabular-nums font-mono text-[11px]">{progressLabel}</span>
                <span className="relative h-1.5 w-16">
                  <span className="absolute left-0 right-0 top-[2.5px] h-[1px] bg-[#ece6db]/12" />
                  <i
                    className={`absolute top-0 h-1.5 w-1.5 rounded-full transition-[left,background-color] duration-700 ease-[cubic-bezier(0.2,0,0,1)] ${isMet ? 'bg-[#c98a72]' : 'bg-[#ece6db]'
                      }`}
                    style={{ left: `${dotALeft}px` }}
                  />
                  <i
                    className={`absolute top-0 h-1.5 w-1.5 rounded-full transition-[left,background-color] duration-700 ease-[cubic-bezier(0.2,0,0,1)] ${isMet ? 'bg-[#c98a72]' : 'bg-[#ece6db]'
                      }`}
                    style={{ left: `${dotBLeft}px` }}
                  />
                </span>
              </div>
            </div>

            {/* Stages */}
            <div className="relative z-10 flex flex-1 items-start md:items-center justify-center pt-7 md:pt-0">
              <AnimatePresence mode="wait" initial={!reduceMotion}>
                {step === 0 && (
                  <motion.section
                    key="step-0"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    className="w-full max-w-[340px] mx-auto"
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">An invitation</b>
                      <span>No. <span className="tabular-nums font-mono">{inviteNo}</span></span>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-3 [text-wrap:balance]">
                      A small circle for people who want to feel more alive.
                    </h1>
                    <p className="text-[#ece6db]/65 text-[13px] leading-[1.55] mb-2.5 [text-wrap:pretty]">
                      We&apos;re building an intentional community of curious, kind, generous people who want to do more interesting things — with and for each other. A place to meet people worth knowing, discover things worth doing, and build friendships that might last a lifetime.
                    </p>
                    <p className="text-[#ece6db]/45 text-[12px] leading-[1.5] mb-6 [text-wrap:pretty]">
                      We care less about what you do and more about who you are and what you bring to the room.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => navigateTo(1)}
                        className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer"
                      >
                        Request an invitation
                        <svg className="w-3.5 h-3.5" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[11px] text-[#ece6db]/38 mt-4.5 uppercase tracking-wide">
                      Starting small. Staying selective.
                    </p>
                  </motion.section>
                )}

                {step === 1 && (
                  <motion.form
                    key="step-1"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    onSubmit={handleNameSubmit}
                    className="w-full max-w-[340px] mx-auto"
                    noValidate
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">We&apos;d like to know you</b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      What should we call you?
                    </h1>
                    <label className="block mt-5.5 mb-3.5">
                      <span className="block text-[11px] text-[#ece6db]/38 mb-1.5">Name</span>
                      <input
                        id={nameId}
                        name="name"
                        className={`w-full h-11 px-3.5 bg-[#ece6db]/[0.04] border-0 rounded-[10px] text-[16px] md:text-[15px] text-[#ece6db] outline-none transition-all duration-150 placeholder:text-[#ece6db]/28 ${error
                            ? 'ring-1 ring-inset ring-[#f0a48c]'
                            : 'ring-1 ring-inset ring-[#ece6db]/12 hover:ring-[#ece6db]/20 focus:ring-[#ece6db]/55 focus:bg-[#ece6db]/[0.06]'
                          }`}
                        placeholder="First name is plenty"
                        value={formData.name}
                        onChange={(e) => {
                          setError('');
                          setFormData((prev) => ({ ...prev, name: e.target.value }));
                        }}
                        autoComplete="given-name"
                        autoFocus
                      />
                    </label>
                    <p className={`text-[11px] mt-2 min-h-4 ${error ? 'text-[#f0a48c]' : 'text-[#ece6db]/38'}`}>
                      {error}
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 2 && (
                  <motion.form
                    key="step-2"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    onSubmit={handleEmailSubmit}
                    className="w-full max-w-[340px] mx-auto"
                    noValidate
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">
                        Nice to meet you{formData.name ? `, ${formData.name.trim().split(/\s+/)[0]}` : ''}
                      </b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      Where should your introductions arrive?
                    </h1>
                    <label className="block mt-5.5 mb-3.5">
                      <span className="block text-[11px] text-[#ece6db]/38 mb-1.5">Email</span>
                      <input
                        id={emailId}
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        spellCheck={false}
                        className={`w-full h-11 px-3.5 bg-[#ece6db]/[0.04] border-0 rounded-[10px] text-[16px] md:text-[15px] text-[#ece6db] outline-none transition-all duration-150 placeholder:text-[#ece6db]/28 ${error
                            ? 'ring-1 ring-inset ring-[#f0a48c]'
                            : 'ring-1 ring-inset ring-[#ece6db]/12 hover:ring-[#ece6db]/20 focus:ring-[#ece6db]/55 focus:bg-[#ece6db]/[0.06]'
                          }`}
                        placeholder="you@domain.com"
                        value={formData.email}
                        onChange={(e) => {
                          setError('');
                          setFormData((prev) => ({ ...prev, email: e.target.value }));
                        }}
                        autoFocus
                      />
                    </label>
                    <p className={`text-[11px] mt-2 min-h-4 ${error ? 'text-[#f0a48c]' : 'text-[#ece6db]/38'}`}>
                      {error || 'Only for introductions. No newsletters.'}
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 3 && (
                  <motion.form
                    key="step-3"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    onSubmit={handleThoughtSubmit}
                    className="w-full max-w-[340px] mx-auto"
                    noValidate
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">So we know you a little</b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      What have you been thinking about lately?
                    </h1>
                    <label className="block mt-5.5 mb-3.5">
                      <span className="sr-only">What you&apos;ve been thinking about</span>
                      <textarea
                        id={thoughtId}
                        name="thought"
                        rows={2}
                        maxLength={140}
                        className={`w-full min-h-[76px] px-3.5 py-3 resize-none bg-[#ece6db]/[0.04] border-0 rounded-[10px] text-[16px] md:text-[15px] leading-[1.45] text-[#ece6db] outline-none transition-all duration-150 placeholder:text-[#ece6db]/28 ${error
                            ? 'ring-1 ring-inset ring-[#f0a48c]'
                            : 'ring-1 ring-inset ring-[#ece6db]/12 hover:ring-[#ece6db]/20 focus:ring-[#ece6db]/55 focus:bg-[#ece6db]/[0.06]'
                          }`}
                        placeholder="A book, a question, a 2 a.m. idea. One line is plenty."
                        value={formData.thought}
                        onChange={(e) => {
                          setError('');
                          setFormData((prev) => ({ ...prev, thought: e.target.value }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleThoughtSubmit(e);
                          }
                        }}
                        autoFocus
                      />
                    </label>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {['Whether to move cities', 'A book I can’t stop quoting', 'Starting something of my own'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setError('');
                            setFormData((prev) => ({ ...prev, thought: chip }));
                          }}
                          className="h-6.5 px-2.5 rounded-[13px] bg-transparent border-0 ring-1 ring-inset ring-[#ece6db]/12 text-[#ece6db]/62 text-[11px] hover:text-[#ece6db] hover:ring-[#ece6db]/30 transition-all duration-150 cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <p className={`text-[11px] mt-2 min-h-4 ${error ? 'text-[#f0a48c]' : 'text-[#ece6db]/38'}`}>
                      {error}
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 4 && (
                  <motion.form
                    key="step-4"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    onSubmit={handleContributionSubmit}
                    className="w-full max-w-[340px] mx-auto"
                    noValidate
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">A little about you</b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      What do you bring to a room?
                    </h1>
                    <label className="block mt-5.5 mb-3.5">
                      <span className="sr-only">What you bring to a room</span>
                      <textarea
                        id={contributionId}
                        name="contribution"
                        rows={3}
                        maxLength={240}
                        className={`w-full min-h-[96px] px-3.5 py-3 resize-none bg-[#ece6db]/[0.04] border-0 rounded-[10px] text-[16px] md:text-[15px] leading-[1.45] text-[#ece6db] outline-none transition-all duration-150 placeholder:text-[#ece6db]/28 ${error
                            ? 'ring-1 ring-inset ring-[#f0a48c]'
                            : 'ring-1 ring-inset ring-[#ece6db]/12 hover:ring-[#ece6db]/20 focus:ring-[#ece6db]/55 focus:bg-[#ece6db]/[0.06]'
                          }`}
                        placeholder="Energy, curiosity, humor, quiet observation — whatever is genuine."
                        value={formData.contribution}
                        onChange={(e) => {
                          setError('');
                          setFormData((prev) => ({ ...prev, contribution: e.target.value }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleContributionSubmit(e);
                          }
                        }}
                        autoFocus
                      />
                    </label>
                    <p className={`text-[11px] mt-2 min-h-4 ${error ? 'text-[#f0a48c]' : 'text-[#ece6db]/38'}`}>
                      {error || 'Tell us something that makes people glad you showed up.'}
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 5 && (
                  <motion.form
                    key="step-5"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    onSubmit={handlePhoneSubmit}
                    className="w-full max-w-[340px] mx-auto"
                    noValidate
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">Last one</b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      Where should we text you when something worth knowing lands?
                    </h1>
                    <p className="text-[13px] leading-[1.5] text-[#ece6db]/62 mb-5 [text-wrap:pretty]">
                      We&apos;ll only use this to follow up on your invitation.
                    </p>
                    <label className="block mb-3.5">
                      <span className="sr-only">Phone number</span>
                      <div
                        className={`flex h-11 overflow-hidden rounded-[10px] bg-[#ece6db]/[0.04] ring-1 ring-inset ${error ? 'ring-[#f0a48c]' : 'ring-[#ece6db]/12 focus-within:ring-[#ece6db]/55'
                          }`}
                      >
                        <select
                          aria-label="Country"
                          value={country.code}
                          onChange={(e) => {
                            const nextCountry = COUNTRIES.find((item) => item.code === e.target.value);
                            if (!nextCountry) return;
                            setCountry(nextCountry);
                            setFormData((prev) => ({
                              ...prev,
                              phone: formatPhoneNumber(prev.phone, nextCountry),
                            }));
                            setError('');
                          }}
                          className="w-[92px] shrink-0 appearance-none border-0 border-r border-[#ece6db]/10 bg-transparent px-2.5 text-[13px] text-[#ece6db] outline-none"
                        >
                          {COUNTRIES.map((item) => (
                            <option key={item.code} value={item.code} className="bg-[#141210]">
                              {item.flag} {item.dialCode}
                            </option>
                          ))}
                        </select>
                        <input
                          id={phoneId}
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          className="min-w-0 flex-1 border-0 bg-transparent px-3.5 text-[16px] md:text-[15px] text-[#ece6db] outline-none placeholder:text-[#ece6db]/28"
                          placeholder={country.mask || 'Phone number'}
                          value={formData.phone}
                          onChange={(e) => {
                            setError('');
                            setFormData((prev) => ({
                              ...prev,
                              phone: formatPhoneNumber(e.target.value, country),
                            }));
                          }}
                          autoFocus
                        />
                      </div>
                    </label>
                    <p className={`text-[11px] mt-2 min-h-4 ${error ? 'text-[#f0a48c]' : 'text-[#ece6db]/38'}`}>
                      {error || "One text if there's something worth knowing. Never shared."}
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#ece6db] text-[#0d0c0b] text-[13px] font-semibold hover:bg-white active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSubmitting ? 'Requesting…' : 'Request an invitation'}
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 6 && (
                  <motion.section
                    key="step-6"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.52, ease: [0.2, 0, 0, 1] }}
                    className="w-full max-w-[340px] mx-auto"
                  >
                    <p className="text-[11px] text-[#ece6db]/38 mb-3.5 flex gap-2">
                      <b className="font-medium text-[#ece6db]/62">We&apos;ll be in touch.</b>
                    </p>
                    <h1 className="text-[23px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.022em] text-[#ece6db] mb-2.5 [text-wrap:balance]">
                      We&apos;re keeping the first circle small.
                    </h1>
                    <figure className="flex gap-0 my-4 mb-4.5 rounded-xl bg-[#141210] ring-1 ring-inset ring-[#ece6db]/12 overflow-hidden">
                      <div className="relative w-28 shrink-0 border-r border-[#ece6db]/12">
                        <CardCanvas seedStr={formData.email + formData.name} />
                      </div>
                      <figcaption className="flex-1 min-w-0 p-3.5 flex flex-col">
                        <div className="flex justify-between items-center text-[10px] text-[#ece6db]/38 mb-3.5">
                          <ForceLogo size={16} />
                          <span className="tabular-nums font-mono">No. {memberNo}</span>
                        </div>
                        <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#ece6db]">{formData.name}</p>
                        <p className="text-xs text-[#ece6db]/62 mt-0.5 truncate">
                          {(formData.contribution || formData.thought) ? `"${(formData.contribution || formData.thought).replace(/[.]$/, '')}"` : ''}
                        </p>
                        <p className="text-[10px] text-[#ece6db]/38 mt-auto pt-2.5 tabular-nums font-mono">
                          Community intake · {joinedDate}
                        </p>
                      </figcaption>
                    </figure>
                    <p className="text-[13px] leading-[1.55] text-[#ece6db]/62 mb-5 [text-wrap:pretty]">
                      Requesting an invitation doesn&apos;t guarantee a place — if we think you&apos;d be a good fit, you&apos;ll hear from us.
                    </p>
                  </motion.section>
                )}

              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
