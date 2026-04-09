"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export default function GlobeThree() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth
    const h = mount.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.NoToneMapping
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
    camera.position.z = 3.0

    const starPos = new Float32Array(3000 * 3)
    const starSizes = new Float32Array(3000)
    for (let i = 0; i < 3000; i += 1) {
      starPos[i * 3] = (Math.random() - 0.5) * 80
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 80
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 80
      starSizes[i] = Math.random() * 0.08 + 0.02
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1))
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.12,
          sizeAttenuation: true,
          transparent: true,
          opacity: 1.0,
        }),
      ),
    )

    const loader = new THREE.TextureLoader()
    const nightTex = loader.load("/earth-night.jpg")
    nightTex.colorSpace = THREE.SRGBColorSpace

    const globeMat = new THREE.ShaderMaterial({
      uniforms: {
        nightTexture: { value: nightTex },
        glowIntensity: { value: 3.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D nightTexture;
        uniform float glowIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;

        vec3 saturate(vec3 color, float factor) {
          float gray = dot(color, vec3(0.299, 0.587, 0.114));
          return mix(vec3(gray), color, factor);
        }

        void main() {
          vec4 nightColor = texture2D(nightTexture, vUv);
          vec3 boosted = nightColor.rgb * glowIntensity;
          boosted = saturate(boosted, 1.1);
          boosted = pow(boosted, vec3(0.6));
          gl_FragColor = vec4(boosted, 1.0);
        }
      `,
    })

    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), globeMat)
    scene.add(globe)

    const atmMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.1, 0.3, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 64), atmMat))

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      globe.rotation.y += 0.001
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
}

