import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Canvas, Circle, Line, Group, Paint } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';
import { layout, project, nearness, RADIUS, BAND_ALPHA, type PNode, type Camera } from '../../lib/world';
import { worldFor } from '../../data/residency';
import { useResidencyStore } from '../../stores/residencyStore';
import { ART_TONE } from '../../data/mira';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 320;

export default function PatternWorld() {
  const { answers, name, aiIntents, aiThemes } = useResidencyStore();

  const [yaw, setYaw] = useState(0.2);
  const [pitch, setPitch] = useState(-0.1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    return worldFor(answers, name, aiIntents, aiThemes);
  }, [answers, name, aiIntents, aiThemes]);

  const pnodes = useMemo(() => {
    return layout(nodes, edges);
  }, [nodes, edges]);

  const camera: Camera = { yaw, pitch, zoom: 1 };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      runOnJS(setYaw)(yaw + e.translationX * 0.002);
      runOnJS(setPitch)(Math.max(-0.8, Math.min(0.8, pitch - e.translationY * 0.002)));
    });

  // Calculate projected positions for nodes and edges
  const projectedNodes = useMemo(() => {
    return pnodes.map((n) => {
      const proj = project(n.p, camera, SCREEN_WIDTH, MAP_HEIGHT);
      const near = nearness(proj.z);
      const tone = ART_TONE[n.art] || ART_TONE.water;
      return {
        ...n,
        proj,
        near,
        tone,
      };
    }).sort((a, b) => a.proj.z - b.proj.z); // Depth sorting
  }, [pnodes, camera]);

  const projectedEdges = useMemo(() => {
    const nodeMap = new Map(projectedNodes.map((n) => [n.id, n]));
    return edges.map(([fromId, toId]) => {
      const from = nodeMap.get(fromId);
      const to = nodeMap.get(toId);
      if (!from || !to) return null;
      return {
        p1: { x: from.proj.x, y: from.proj.y },
        p2: { x: to.proj.x, y: to.proj.y },
        alpha: Math.min(from.near, to.near) * 0.35,
      };
    }).filter(Boolean);
  }, [projectedNodes, edges]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.canvasWrapper}>
          <Canvas style={{ width: SCREEN_WIDTH, height: MAP_HEIGHT }}>
            {/* Strands / Edges */}
            {projectedEdges.map((e: any, idx) => (
              <Line
                key={`edge-${idx}`}
                p1={e.p1}
                p2={e.p2}
                color={`rgba(24, 24, 27, ${e.alpha})`}
                strokeWidth={1.2}
              />
            ))}

            {/* Projected Sphere Nodes */}
            {projectedNodes.map((n) => {
              const radius = (RADIUS[n.kind] || 8) * n.proj.s;
              const isSelected = selectedNode === n.id;
              return (
                <Group key={n.id}>
                  {/* Outer glow ring */}
                  <Circle
                    cx={n.proj.x}
                    cy={n.proj.y}
                    r={radius + (isSelected ? 4 : 2)}
                    color={n.tone.tint}
                    opacity={n.near * 0.8}
                  />
                  {/* Core node bead */}
                  <Circle
                    cx={n.proj.x}
                    cy={n.proj.y}
                    r={radius}
                    color={n.tone.main}
                    opacity={n.near}
                  />
                </Group>
              );
            })}
          </Canvas>

          {/* Floating node labels in 2D space above canvas */}
          {projectedNodes
            .filter((n) => n.near > 0.5)
            .map((n) => (
              <View
                key={`label-${n.id}`}
                pointerEvents="none"
                style={[
                  styles.nodeLabel,
                  {
                    left: n.proj.x - 40,
                    top: n.proj.y + 12,
                    opacity: n.near,
                  },
                ]}
              >
                <Text style={styles.labelText} numberOfLines={1}>
                  {n.title}
                </Text>
              </View>
            ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: MAP_HEIGHT,
    backgroundColor: '#FAF9F6',
    borderRadius: 24,
    overflow: 'hidden',
    marginVertical: 12,
  },
  canvasWrapper: {
    flex: 1,
  },
  nodeLabel: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#18181B',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
