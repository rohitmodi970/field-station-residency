import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Vertex Shader: Handles particle movement and noise displacement
const vertexShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uHover;
  
  attribute float aScale;
  attribute vec3 aRandom;
  
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vDist;

  // Simplex noise function (simplified)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vUv = uv;
    
    // Basic sphere position
    vec3 pos = position;
    
    // Noise settings
    float noiseFreq = 1.5;
    float noiseAmp = 0.4 + (uIntensity * 0.5);
    
    // Animate noise
    float time = uTime * (0.2 + (uIntensity * 0.8));
    
    // Calculate noise displacement
    vec3 noisePos = vec3(pos.x * noiseFreq + time, pos.y * noiseFreq + time, pos.z * noiseFreq);
    float noiseVal = snoise(noisePos);
    
    // Displace outward based on noise
    vec3 displaced = pos + normalize(pos) * noiseVal * noiseAmp;
    
    // Add some random scatter based on hover
    displaced += aRandom * uHover * 0.5;

    vDist = length(displaced);

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    
    // Size attenuation
    gl_PointSize = (8.0 * aScale + (noiseVal * 5.0)) * (10.0 / -mvPosition.z);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader: Themed colors and grain
const fragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uTime;
  
  varying float vDist;

  // Random function for grain
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    // Create circular particle
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    if (r > 0.5) discard;
    
    // Soft edge
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    // Color mixing based on distance
    float mixVal = smoothstep(0.8, 1.8, vDist);
    
    vec3 finalColor = mix(uColor2, uColor1, mixVal);
    
    // Add splashes of accent color
    float accentMix = step(0.98, random(gl_PointCoord + vDist + uTime));
    finalColor = mix(finalColor, uColor3, accentMix * 0.5);

    // Grain effect
    float grain = random(gl_FragCoord.xy * 0.01 + uTime);
    float opacity = 0.85;

    if (grain < 0.2) opacity = 0.4;
    
    gl_FragColor = vec4(finalColor, opacity * glow);
  }
`;

interface ForceParticlesProps {
  isThinking: boolean;
  isHovered: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const ForceParticles: React.FC<ForceParticlesProps> = ({ 
  isThinking, 
  isHovered,
  primaryColor,
  secondaryColor,
  accentColor
}) => {
  const mesh = useRef<THREE.Points>(null);

  // Configuration
  const count = 4000;
  const radius = 2;

  const particles = useMemo(() => {
    const tempPositions = new Float32Array(count * 3);
    const tempRandoms = new Float32Array(count * 3);
    const tempScales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      tempPositions[i * 3] = x;
      tempPositions[i * 3 + 1] = y;
      tempPositions[i * 3 + 2] = z;

      tempRandoms[i * 3] = (Math.random() - 0.5);
      tempRandoms[i * 3 + 1] = (Math.random() - 0.5);
      tempRandoms[i * 3 + 2] = (Math.random() - 0.5);

      tempScales[i] = Math.random();
    }

    return {
      positions: tempPositions,
      randoms: tempRandoms,
      scales: tempScales,
    };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uHover: { value: 0 },
      uColor1: { value: new THREE.Color(primaryColor) },
      uColor2: { value: new THREE.Color(secondaryColor) },
      uColor3: { value: new THREE.Color(accentColor) },
    }),
    [primaryColor, secondaryColor, accentColor]
  );

  useFrame((state) => {
    const { clock } = state;
    if (mesh.current) {
      const material = mesh.current.material as THREE.ShaderMaterial;
      // Update uniforms
      if (material.uniforms?.uTime) {
        material.uniforms.uTime.value = clock.getElapsedTime();
      }
      
      // Smoothly interpolate intensity (thinking state)
      const targetIntensity = isThinking ? 1.0 : 0.0;
      if (material.uniforms?.uIntensity) {
        material.uniforms.uIntensity.value = THREE.MathUtils.lerp(
          material.uniforms.uIntensity.value,
          targetIntensity,
          0.05
        );
      }

      // Smoothly interpolate hover state
      const targetHover = isHovered ? 1.0 : 0.0;
      if (material.uniforms?.uHover) {
        material.uniforms.uHover.value = THREE.MathUtils.lerp(
          material.uniforms.uHover.value,
          targetHover,
          0.1
        );
      }

      // Slight rotation
      mesh.current.rotation.y = clock.getElapsedTime() * 0.1;
      mesh.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.1;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles.positions, 3]}
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          args={[particles.randoms, 3]}
          count={particles.randoms.length / 3}
          array={particles.randoms}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          args={[particles.scales, 1]}
          count={particles.scales.length}
          array={particles.scales}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default ForceParticles;
