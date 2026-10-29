import React, { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Blur,
  Canvas,
  ColorMatrix,
  FractalNoise,
  Group,
  Image as SkImage,
  Paint,
  Path,
  Rect,
  Skia,
  useImage,
  type SkPath,
} from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ART_COVERS, GRAIN_ASSET } from '../../data/mira';

export const WING_L =
  'M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8529 33.1043 85.3772 32.024Z';

export const WING_R =
  'M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1043 120.579 32.024Z';

export const DOT =
  'M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z';

export const BODY =
  'M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z';

export const VB = { x: 4, y: 2, w: 198, h: 150 };

type Stroke = { pts: [number, number][]; w: number; t0: number; dur: number };

const LEFT: [number, number][] = [
  [12, 26], [40, 32], [68, 38], [86, 44], [89, 52], [84, 59], [66, 62],
  [50, 65], [43, 72], [47, 80], [60, 81], [80, 76], [90, 70],
];
const RIGHT: [number, number][] = [
  [194, 26], [166, 32], [138, 38], [120, 44], [117, 52], [122, 59], [140, 62],
  [156, 65], [163, 72], [159, 80], [146, 81], [126, 76], [116, 70],
];
const STEM: [number, number][] = [
  [117, 68], [117, 88], [117, 108], [117, 128], [117, 144],
];

const STROKES: Stroke[] = [
  { pts: LEFT, w: 26, t0: 0, dur: 0.65 },
  { pts: RIGHT, w: 26, t0: 0.15, dur: 0.65 },
  { pts: STEM, w: 22, t0: 0.35, dur: 0.5 },
  { pts: [[104, 10]], w: 14, t0: 0.5, dur: 0.2 },
];

const DUR = 1.0;

function buildBrushPath(pts: [number, number][]): SkPath {
  const p = Skia.Path.Make();
  if (pts.length === 0) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) {
    p.lineTo(pts[0][0] + 0.01, pts[0][1]);
    return p;
  }
  for (let i = 1; i < pts.length; i++) {
    p.lineTo(pts[i][0], pts[i][1]);
  }
  return p;
}

export default function PaintedMark({
  size = 236,
  onDone,
}: {
  size?: number;
  onDone?: () => void;
}) {
  const scale = size / VB.w;
  const canvasHeight = Math.round(VB.h * scale);
  const canvasWidth = Math.round(VB.w * scale);

  const cover = useImage(ART_COVERS.hills);
  const grain = useImage(GRAIN_ASSET);

  const outlinePath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addPath(Skia.Path.MakeFromSVGString(WING_L)!);
    p.addPath(Skia.Path.MakeFromSVGString(WING_R)!);
    p.addPath(Skia.Path.MakeFromSVGString(BODY)!);
    p.addPath(Skia.Path.MakeFromSVGString(DOT)!);
    return p;
  }, []);

  const brushPaths = useMemo(() => STROKES.map((s) => buildBrushPath(s.pts)), []);
  const prog = useSharedValue(0);

  useEffect(() => {
    prog.value = withTiming(
      1,
      { duration: DUR * 1000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
      (finished) => {
        if (finished && onDone) {
          runOnJS(onDone)();
        }
      }
    );
  }, []);

  return (
    <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
      <Group
        transform={[
          { scale },
          { translateX: -VB.x },
          { translateY: -VB.y },
        ]}
      >
        {cover && (
          <Group clip={outlinePath}>
            <SkImage
              image={cover}
              x={0}
              y={0}
              width={VB.w}
              height={VB.h}
              fit="cover"
            />
          </Group>
        )}
      </Group>
    </Canvas>
  );
}
