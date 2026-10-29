import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ART_COVERS, type Art } from '../../data/mira';

interface GlassProps {
  size?: number;
  art?: Art;
  x?: number; // 0..100 crop offset
  y?: number; // 0..100 crop offset
  zoom?: number; // crop percentage
  children?: React.ReactNode;
  style?: any;
}

export default function Glass({
  size = 40,
  art = 'water',
  x = 50,
  y = 50,
  zoom = 300,
  children,
  style,
}: GlassProps) {
  const imageSource = ART_COVERS[art] || ART_COVERS.water;
  const radius = size / 2;

  // Calculate inner image dimensions and offsets based on zoom and {x, y}
  const imgSize = (size * zoom) / 100;
  const left = -((imgSize - size) * (x / 100));
  const top = -((imgSize - size) * (y / 100));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {/* Cropped Painting Background */}
      <View style={[styles.cropContainer, { borderRadius: radius }]}>
        <Image
          source={imageSource}
          style={{
            position: 'absolute',
            width: imgSize,
            height: imgSize,
            left,
            top,
          }}
          resizeMode="cover"
        />
        {/* Soft Glass Glaze Overlay */}
        <View style={[styles.glaze, { borderRadius: radius }]} />
      </View>

      {/* Center Icon / Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cropContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glaze: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  content: {
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
