"use client";
// @ts-nocheck
import { useEffect, useRef } from "react";

function SplashCursor({
  // Add whatever props you like for customization
  SIM_RESOLUTION = 128,
  DYE_RESOLUTION = 1440,
  CAPTURE_RESOLUTION = 512,
  DENSITY_DISSIPATION = 3.5,
  VELOCITY_DISSIPATION = 2,
  PRESSURE = 0.1,
  PRESSURE_ITERATIONS = 20,
  CURL = 3,
  SPLAT_RADIUS = 0.2,
  SPLAT_FORCE = 6000,
  SHADING = true,
  COLOR_UPDATE_SPEED = 10,
  BACK_COLOR = { r: 0.5, g: 0, b: 0 },
  TRANSPARENT = true,
}: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function pointerPrototype(this: any) {
      this.id = -1;
      this.texcoordX = 0;
      this.texcoordY = 0;
      this.prevTexcoordX = 0;
      this.prevTexcoordY = 0;
      this.deltaX = 0;
      this.deltaY = 0;
      this.down = false;
      this.moved = false;
      this.color = [0, 0, 0];
    }

    let config = {
      SIM_RESOLUTION,
      DYE_RESOLUTION,
      CAPTURE_RESOLUTION,
      DENSITY_DISSIPATION,
      VELOCITY_DISSIPATION,
      PRESSURE,
      PRESSURE_ITERATIONS,
      CURL,
      SPLAT_RADIUS,
      SPLAT_FORCE,
      SHADING,
      COLOR_UPDATE_SPEED,
      PAUSED: false,
      BACK_COLOR,
      TRANSPARENT,
    };

    let pointers = [new (pointerPrototype as any)()];

    const { gl, ext } = getWebGLContext(canvas);
    if (
      !gl ||
      !(
        gl instanceof WebGLRenderingContext ||
        gl instanceof WebGL2RenderingContext
      )
    )
      return;
    const glCtx = gl as WebGLRenderingContext | WebGL2RenderingContext;
    const isWebGL2Ctx =
      typeof WebGL2RenderingContext !== "undefined" &&
      glCtx instanceof WebGL2RenderingContext;
    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
      config.SHADING = false;
    }

    function getWebGLContext(canvas: HTMLCanvasElement) {
      const params = {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
      };
      let gl = canvas.getContext("webgl2", params);
      const isWebGL2 = !!gl;
      if (!isWebGL2)
        gl =
          canvas.getContext("webgl", params) ||
          canvas.getContext("experimental-webgl", params);
      let halfFloat;
      let supportLinearFiltering;
      if (isWebGL2) {
        (gl as WebGL2RenderingContext).getExtension("EXT_color_buffer_float");
        supportLinearFiltering = (gl as WebGL2RenderingContext).getExtension(
          "OES_texture_float_linear"
        );
      } else {
        halfFloat = (gl as WebGLRenderingContext).getExtension(
          "OES_texture_half_float"
        );
        supportLinearFiltering = (gl as WebGLRenderingContext).getExtension(
          "OES_texture_half_float_linear"
        );
      }
      (gl as WebGLRenderingContext).clearColor(0.0, 0.0, 0.0, 1.0);
      const halfFloatTexType = isWebGL2
        ? (gl as WebGL2RenderingContext).HALF_FLOAT
        : halfFloat && (halfFloat as any).HALF_FLOAT_OES;
      let formatRGBA;
      let formatRG;
      let formatR;

      if (isWebGL2) {
        const gl2 = gl as WebGL2RenderingContext;
        formatRGBA = getSupportedFormat(
          gl2,
          gl2.RGBA16F,
          gl2.RGBA,
          halfFloatTexType
        );
        formatRG = getSupportedFormat(gl2, gl2.RG16F, gl2.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl2, gl2.R16F, gl2.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(
          gl as WebGLRenderingContext,
          (gl as WebGLRenderingContext).RGBA,
          (gl as WebGLRenderingContext).RGBA,
          halfFloatTexType
        );
        formatRG = getSupportedFormat(
          gl as WebGLRenderingContext,
          (gl as WebGLRenderingContext).RGBA,
          (gl as WebGLRenderingContext).RGBA,
          halfFloatTexType
        );
        formatR = getSupportedFormat(
          gl as WebGLRenderingContext,
          (gl as WebGLRenderingContext).RGBA,
          (gl as WebGLRenderingContext).RGBA,
          halfFloatTexType
        );
      }

      return {
        gl,
        ext: {
          formatRGBA,
          formatRG,
          formatR,
          halfFloatTexType,
          supportLinearFiltering,
        },
      };
    }

    function getSupportedFormat(
      gl: WebGLRenderingContext | WebGL2RenderingContext,
      internalFormat: number,
      format: number,
      type: number
    ) {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        // Use type guards for WebGL2 constants
        if (
          typeof WebGL2RenderingContext !== "undefined" &&
          gl instanceof WebGL2RenderingContext
        ) {
          const gl2 = gl as WebGL2RenderingContext;
          switch (internalFormat) {
            case gl2.R16F:
              return getSupportedFormat(gl2, gl2.RG16F, gl2.RG, type);
            case gl2.RG16F:
              return getSupportedFormat(gl2, gl2.RGBA16F, gl2.RGBA, type);
            default:
              return null;
          }
        } else {
          // fallback for WebGL1: just return null
          return null;
        }
      }
      return {
        internalFormat,
        format,
      };
    }

    function supportRenderTextureFormat(
      gl: WebGLRenderingContext | WebGL2RenderingContext,
      internalFormat: number,
      format: number,
      type: number
    ) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        4,
        4,
        0,
        format,
        type,
        null
      );
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }

    class Material {
      vertexShader: WebGLShader;
      fragmentShaderSource: string;
      programs: { [hash: number]: WebGLProgram };
      activeProgram: WebGLProgram | null;
      uniforms: { [name: string]: WebGLUniformLocation | null };
      constructor(vertexShader: WebGLShader, fragmentShaderSource: string) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = {};
        this.activeProgram = null;
        this.uniforms = {};
      }
      setKeywords(keywords: string[]) {
        if (!gl) return;
        let hash = 0;
        for (let i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
        let program = this.programs[hash];
        if (program == null) {
          let fragmentShader = safeCompileShader(
            (gl as WebGLRenderingContext).FRAGMENT_SHADER,
            this.fragmentShaderSource,
            keywords
          );
          program = createProgram(this.vertexShader, fragmentShader);
          this.programs[hash] = program;
        }
        if (program === this.activeProgram) return;
        this.uniforms = getUniforms(program);
        this.activeProgram = program;
      }
      bind() {
        if (!gl || !this.activeProgram) return;
        (gl as WebGLRenderingContext).useProgram(this.activeProgram);
      }
    }

    class Program {
      uniforms: { [name: string]: WebGLUniformLocation | null };
      program: WebGLProgram;
      constructor(vertexShader: WebGLShader, fragmentShader: WebGLShader) {
        if (!gl) throw new Error("WebGL context not initialized");
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
      }
      bind() {
        if (!gl) return;
        (gl as WebGLRenderingContext).useProgram(this.program);
      }
    }

    function createProgram(
      vertexShader: WebGLShader,
      fragmentShader: WebGLShader
    ): WebGLProgram {
      if (!gl) throw new Error("WebGL context not initialized");
      let program = (gl as WebGLRenderingContext).createProgram();
      (gl as WebGLRenderingContext).attachShader(program, vertexShader);
      (gl as WebGLRenderingContext).attachShader(program, fragmentShader);
      (gl as WebGLRenderingContext).linkProgram(program);
      if (
        !(gl as WebGLRenderingContext).getProgramParameter(
          program,
          (gl as WebGLRenderingContext).LINK_STATUS
        )
      )
        console.trace((gl as WebGLRenderingContext).getProgramInfoLog(program));
      return program;
    }

    function getUniforms(program: WebGLProgram): {
      [name: string]: WebGLUniformLocation | null;
    } {
      if (!gl) throw new Error("WebGL context not initialized");
      let uniforms: { [name: string]: WebGLUniformLocation | null } = {};
      let uniformCount = (gl as WebGLRenderingContext).getProgramParameter(
        program,
        (gl as WebGLRenderingContext).ACTIVE_UNIFORMS
      );
      for (let i = 0; i < uniformCount; i++) {
        let uniformName = (gl as WebGLRenderingContext).getActiveUniform(
          program,
          i
        ).name;
        uniforms[uniformName] = (
          gl as WebGLRenderingContext
        ).getUniformLocation(program, uniformName);
      }
      return uniforms;
    }

    function addKeywords(source: string, keywords: string[] | undefined) {
      if (!keywords) return source;
      let keywordsString = "";
      keywords.forEach((keyword) => {
        keywordsString += "#define " + keyword + "\n";
      });
      return keywordsString + source;
    }

    // --- Fix: Add missing compileShader function ---
    function compileShader(
      type: number,
      source: string,
      keywords?: string[]
    ): WebGLShader | null {
      if (!gl) return null;
      const shader = (gl as WebGLRenderingContext).createShader(type);
      if (!shader) return null;
      const finalSource = addKeywords(source, keywords);
      (gl as WebGLRenderingContext).shaderSource(shader, finalSource);
      (gl as WebGLRenderingContext).compileShader(shader);
      if (
        !(gl as WebGLRenderingContext).getShaderParameter(
          shader,
          (gl as WebGLRenderingContext).COMPILE_STATUS
        )
      ) {
        console.error(
          "Shader compile error:",
          (gl as WebGLRenderingContext).getShaderInfoLog(shader)
        );
        (gl as WebGLRenderingContext).deleteShader(shader);
        return null;
      }
      return shader;
    }

    // --- Fix: Add null checks for compileShader return values ---
    function safeCompileShader(
      type: number,
      source: string,
      keywords?: string[]
    ): WebGLShader {
      const shader = compileShader(type, source, keywords);
      if (!shader) throw new Error("Failed to compile shader");
      return shader;
    }

    // --- Use safeCompileShader for all shader creation (never null) ---
    const baseVertexShader = safeCompileShader(
      (gl as WebGLRenderingContext).VERTEX_SHADER,
      `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;

        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `
    );

    const copyShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;

        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }
      `
    );

    const clearShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;

        void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
        }
     `
    );

    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform sampler2D uDithering;
      uniform vec2 ditherScale;
      uniform vec2 texelSize;

      vec3 linearToGamma (vec3 color) {
          color = max(color, vec3(0));
          return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }

      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;
          #ifdef SHADING
              vec3 lc = texture2D(uTexture, vL).rgb;
              vec3 rc = texture2D(uTexture, vR).rgb;
              vec3 tc = texture2D(uTexture, vT).rgb;
              vec3 bc = texture2D(uTexture, vB).rgb;

              float dx = length(rc) - length(lc);
              float dy = length(tc) - length(bc);

              vec3 n = normalize(vec3(dx, dy, length(texelSize)));
              vec3 l = vec3(0.0, 0.0, 1.0);

              float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
              c *= diffuse;
          #endif

          float a = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c, a);
      }
    `;

    // --- Use safeCompileShader for all shader creation (never null) ---
    const splatShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;

        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
      `
    );

    const divergenceShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;

        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `
    );

    const curlShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
      `
    );

    const vorticityShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;

        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;

            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;

            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity += force * dt;
            velocity = min(max(velocity, -1000.0), 1000.0);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `
    );

    const pressureShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
      `
    );

    const gradientSubtractShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;

        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `
    );

    // --- Type guard for .fbo property with width/height ---
    function hasFBO(
      obj: any
    ): obj is { fbo: WebGLFramebuffer; width: number; height: number } {
      return (
        obj &&
        typeof obj === "object" &&
        "fbo" in obj &&
        "width" in obj &&
        "height" in obj
      );
    }

    const blit = (() => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return (
        target:
          | HTMLCanvasElement
          | { fbo: WebGLFramebuffer; width: number; height: number }
          | null,
        clear = false
      ) => {
        if (target == null) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else if (hasFBO(target)) {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        if (clear) {
          gl.clearColor(0.0, 0.0, 0.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    // Update types for double FBOs
    type DoubleFBO = {
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
      read: {
        texture: WebGLTexture;
        fbo: WebGLFramebuffer;
        width: number;
        height: number;
        texelSizeX: number;
        texelSizeY: number;
        attach: (id: number) => number;
      };
      write: {
        texture: WebGLTexture;
        fbo: WebGLFramebuffer;
        width: number;
        height: number;
        texelSizeX: number;
        texelSizeY: number;
        attach: (id: number) => number;
      };
      swap: () => void;
    };

    let dye: DoubleFBO | null = null;
    let velocity: DoubleFBO | null = null;
    let pressure: DoubleFBO | null = null;
    // single FBOs
    let divergence: {
      texture: WebGLTexture;
      fbo: WebGLFramebuffer;
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
      attach: (id: number) => number;
    } | null = null;
    let curl: {
      texture: WebGLTexture;
      fbo: WebGLFramebuffer;
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
      attach: (id: number) => number;
    } | null = null;

    const copyProgram = new Program(baseVertexShader, copyShader);
    const clearProgram = new Program(baseVertexShader, clearShader);
    const splatProgram = new Program(baseVertexShader, splatShader);
    // --- Ensure advectionShader is defined and in scope ---
    const advectionShader = safeCompileShader(
      (gl as WebGLRenderingContext).FRAGMENT_SHADER,
      `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform vec2 dyeTexelSize;
        uniform float dt;
        uniform float dissipation;

        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5;
            vec2 iuv = floor(st);
            vec2 fuv = fract(st);

            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

            return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }

        void main () {
            #ifdef MANUAL_FILTERING
                vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
                vec4 result = bilerp(uSource, coord, dyeTexelSize);
            #else
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                vec4 result = texture2D(uSource, coord);
            #endif
            float decay = 1.0 + dissipation * dt;
            gl_FragColor = result / decay;
        }
      `,
      ext.supportLinearFiltering ? undefined : ["MANUAL_FILTERING"]
    );
    const advectionProgram = new Program(baseVertexShader, advectionShader);

    const divergenceProgram = new Program(baseVertexShader, divergenceShader);
    const curlProgram = new Program(baseVertexShader, curlShader);
    const vorticityProgram = new Program(baseVertexShader, vorticityShader);
    const pressureProgram = new Program(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new Program(
      baseVertexShader,
      gradientSubtractShader
    );
    const displayMaterial = new Material(baseVertexShader, displayShaderSource);

    function initFramebuffers() {
      let simRes = getResolution(config.SIM_RESOLUTION);
      let dyeRes = getResolution(config.DYE_RESOLUTION);
      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      if (!gl) throw new Error("WebGL context not initialized");
      if (!rgba || !rg || !r)
        throw new Error("Required framebuffer format is null");
      const filtering = ext.supportLinearFiltering
        ? (gl as WebGLRenderingContext).LINEAR
        : (gl as WebGLRenderingContext).NEAREST;
      (gl as WebGLRenderingContext).disable(
        (gl as WebGLRenderingContext).BLEND
      );

      if (!dye)
        dye = createDoubleFBO(
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering
        ) as DoubleFBO;
      else
        dye = resizeDoubleFBO(
          dye,
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering
        ) as DoubleFBO;

      if (!velocity)
        velocity = createDoubleFBO(
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering
        ) as DoubleFBO;
      else
        velocity = resizeDoubleFBO(
          velocity,
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering
        ) as DoubleFBO;

      divergence = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        (gl as WebGLRenderingContext).NEAREST
      ) as typeof divergence;
      curl = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        (gl as WebGLRenderingContext).NEAREST
      ) as typeof curl;
      pressure = createDoubleFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        (gl as WebGLRenderingContext).NEAREST
      ) as DoubleFBO;
    }

    function createFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      if (!gl) throw new Error("WebGL context not initialized");
      (gl as WebGLRenderingContext).activeTexture(
        (gl as WebGLRenderingContext).TEXTURE0
      );
      let texture = (gl as WebGLRenderingContext).createTexture();
      (gl as WebGLRenderingContext).bindTexture(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        texture
      );
      (gl as WebGLRenderingContext).texParameteri(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        (gl as WebGLRenderingContext).TEXTURE_MIN_FILTER,
        param
      );
      (gl as WebGLRenderingContext).texParameteri(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        (gl as WebGLRenderingContext).TEXTURE_MAG_FILTER,
        param
      );
      (gl as WebGLRenderingContext).texParameteri(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        (gl as WebGLRenderingContext).TEXTURE_WRAP_S,
        (gl as WebGLRenderingContext).CLAMP_TO_EDGE
      );
      (gl as WebGLRenderingContext).texParameteri(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        (gl as WebGLRenderingContext).TEXTURE_WRAP_T,
        (gl as WebGLRenderingContext).CLAMP_TO_EDGE
      );
      (gl as WebGLRenderingContext).texImage2D(
        (gl as WebGLRenderingContext).TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null
      );

      let fbo = (gl as WebGLRenderingContext).createFramebuffer();
      (gl as WebGLRenderingContext).bindFramebuffer(
        (gl as WebGLRenderingContext).FRAMEBUFFER,
        fbo
      );
      (gl as WebGLRenderingContext).framebufferTexture2D(
        (gl as WebGLRenderingContext).FRAMEBUFFER,
        (gl as WebGLRenderingContext).COLOR_ATTACHMENT0,
        (gl as WebGLRenderingContext).TEXTURE_2D,
        texture,
        0
      );
      (gl as WebGLRenderingContext).viewport(0, 0, w, h);
      (gl as WebGLRenderingContext).clear(
        (gl as WebGLRenderingContext).COLOR_BUFFER_BIT
      );

      let texelSizeX = 1.0 / w;
      let texelSizeY = 1.0 / h;
      return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach(id: number) {
          if (!gl) throw new Error("WebGL context not initialized");
          (gl as WebGLRenderingContext).activeTexture(
            (gl as WebGLRenderingContext).TEXTURE0 + id
          );
          (gl as WebGLRenderingContext).bindTexture(
            (gl as WebGLRenderingContext).TEXTURE_2D,
            texture
          );
          return id;
        },
      };
    }

    function createDoubleFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
          return fbo1;
        },
        set read(value: {
          texture: WebGLTexture;
          fbo: WebGLFramebuffer;
          width: number;
          height: number;
          texelSizeX: number;
          texelSizeY: number;
          attach: (id: number) => number;
        }) {
          fbo1 = value;
        },
        get write() {
          return fbo2;
        },
        set write(value: {
          texture: WebGLTexture;
          fbo: WebGLFramebuffer;
          width: number;
          height: number;
          texelSizeX: number;
          texelSizeY: number;
          attach: (id: number) => number;
        }) {
          fbo2 = value;
        },
        swap() {
          let temp = fbo1;
          fbo1 = fbo2;
          fbo2 = temp;
        },
      };
    }

    function resizeFBO(
      target: {
        texture: WebGLTexture;
        fbo: WebGLFramebuffer;
        width: number;
        height: number;
        texelSizeX: number;
        texelSizeY: number;
        attach: (id: number) => number;
      },
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      let newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }

    function resizeDoubleFBO(
      target: DoubleFBO,
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(
        target.read,
        w,
        h,
        internalFormat,
        format,
        type,
        param
      );
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1.0 / w;
      target.texelSizeY = 1.0 / h;
      return target;
    }

    function updateKeywords() {
      let displayKeywords = [];
      if (config.SHADING) displayKeywords.push("SHADING");
      displayMaterial.setKeywords(displayKeywords);
    }

    updateKeywords();
    initFramebuffers();
    let lastUpdateTime = Date.now();
    let colorUpdateTimer = 0.0;

    let animationFrameId: number;

    function updateFrame() {
      const dt = calcDeltaTime();
      if (resizeCanvas()) initFramebuffers();
      updateColors(dt);
      applyInputs();
      step(dt);
      render(null);
      animationFrameId = requestAnimationFrame(updateFrame);
    }

    function calcDeltaTime() {
      let now = Date.now();
      let dt = (now - lastUpdateTime) / 1000;
      dt = Math.min(dt, 0.016666);
      lastUpdateTime = now;
      return dt;
    }

    function resizeCanvas() {
      let width = scaleByPixelRatio(window.innerWidth);
      let height = scaleByPixelRatio(window.innerHeight);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        return true;
      }
      return false;
    }

    function updateColors(dt: number) {
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach((p) => {
          p.color = generateColor();
        });
      }
    }

    function applyInputs() {
      pointers.forEach((p) => {
        if (p.moved) {
          p.moved = false;
          splatPointer(p);
        }
      });
    }

    function step(dt: number) {
      if (!gl) return;
      if (!curl) return;
      const glCtx = gl as WebGLRenderingContext | WebGL2RenderingContext;
      glCtx.disable(glCtx.BLEND);
      // Curl
      curlProgram.bind();
      glCtx.uniform2f(
        curlProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      glCtx.uniform1i(curlProgram.uniforms.uVelocity, velocity!.read.attach(0));
      blit(curl);

      // Vorticity
      vorticityProgram.bind();
      glCtx.uniform2f(
        vorticityProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      glCtx.uniform1i(
        vorticityProgram.uniforms.uVelocity,
        velocity!.read.attach(0)
      );
      glCtx.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      glCtx.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      glCtx.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity!.write);
      velocity!.swap();

      // Divergence
      divergenceProgram.bind();
      glCtx.uniform2f(
        divergenceProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      glCtx.uniform1i(
        divergenceProgram.uniforms.uVelocity,
        velocity!.read.attach(0)
      );
      blit(divergence);

      // Clear pressure
      clearProgram.bind();
      glCtx.uniform1i(clearProgram.uniforms.uTexture, pressure!.read.attach(0));
      glCtx.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure!.write);
      pressure!.swap();

      // Pressure
      pressureProgram.bind();
      glCtx.uniform2f(
        pressureProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      glCtx.uniform1i(
        pressureProgram.uniforms.uDivergence,
        divergence!.attach(0)
      );
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        glCtx.uniform1i(
          pressureProgram.uniforms.uPressure,
          pressure!.read.attach(1)
        );
        blit(pressure!.write);
        pressure!.swap();
      }

      // Gradient Subtract
      gradienSubtractProgram.bind();
      glCtx.uniform2f(
        gradienSubtractProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      glCtx.uniform1i(
        gradienSubtractProgram.uniforms.uPressure,
        pressure!.read.attach(0)
      );
      glCtx.uniform1i(
        gradienSubtractProgram.uniforms.uVelocity,
        velocity!.read.attach(1)
      );
      blit(velocity!.write);
      velocity!.swap();

      // Advection
      advectionProgram.bind();
      glCtx.uniform2f(
        advectionProgram.uniforms.texelSize,
        velocity!.texelSizeX,
        velocity!.texelSizeY
      );
      if (!ext.supportLinearFiltering)
        glCtx.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          velocity!.texelSizeX,
          velocity!.texelSizeY
        );
      let velocityId = velocity!.read.attach(0);
      glCtx.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      glCtx.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      glCtx.uniform1f(advectionProgram.uniforms.dt, dt);
      glCtx.uniform1f(
        advectionProgram.uniforms.dissipation,
        config.VELOCITY_DISSIPATION
      );
      blit(velocity!.write);
      velocity!.swap();

      if (!ext.supportLinearFiltering)
        glCtx.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          dye!.texelSizeX,
          dye!.texelSizeY
        );
      glCtx.uniform1i(
        advectionProgram.uniforms.uVelocity,
        velocity!.read.attach(0)
      );
      glCtx.uniform1i(advectionProgram.uniforms.uSource, dye!.read.attach(1));
      glCtx.uniform1f(
        advectionProgram.uniforms.dissipation,
        config.DENSITY_DISSIPATION
      );
      blit(dye!.write);
      dye!.swap();
    }

    function render(target: HTMLCanvasElement | null) {
      const glCtx = gl as WebGLRenderingContext | WebGL2RenderingContext;
      glCtx.blendFunc(glCtx.ONE, glCtx.ONE_MINUS_SRC_ALPHA);
      glCtx.enable(glCtx.BLEND);
      drawDisplay(target);
    }

    function drawDisplay(target: HTMLCanvasElement | null) {
      if (!gl) return;
      const glCtx = gl as WebGLRenderingContext | WebGL2RenderingContext;
      let width = target == null ? glCtx.drawingBufferWidth : target.width;
      let height = target == null ? glCtx.drawingBufferHeight : target.height;
      displayMaterial.bind();
      if (config.SHADING)
        glCtx.uniform2f(
          displayMaterial.uniforms.texelSize,
          1.0 / width,
          1.0 / height
        );
      glCtx.uniform1i(displayMaterial.uniforms.uTexture, dye!.read.attach(0));
      blit(target);
    }

    function splatPointer(pointer: {
      id: number;
      texcoordX: number;
      texcoordY: number;
      prevTexcoordX: number;
      prevTexcoordY: number;
      deltaX: number;
      deltaY: number;
      down: boolean;
      moved: boolean;
      color: number[];
    }) {
      let dx = pointer.deltaX * config.SPLAT_FORCE;
      let dy = pointer.deltaY * config.SPLAT_FORCE;
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }

    function clickSplat(pointer: {
      id: number;
      texcoordX: number;
      texcoordY: number;
      prevTexcoordX: number;
      prevTexcoordY: number;
      deltaX: number;
      deltaY: number;
      down: boolean;
      moved: boolean;
      color: number[];
    }) {
      const { r = 0, g = 0, b = 0 } = generateColor();
      const color = [r * 10.0, g * 10.0, b * 10.0];
      let dx = 10 * (Math.random() - 0.5);
      let dy = 30 * (Math.random() - 0.5);
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
    }

    function splat(
      x: number,
      y: number,
      dx: number,
      dy: number,
      color: number[]
    ) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity!.read.attach(0));
      gl.uniform1f(
        splatProgram.uniforms.aspectRatio,
        canvas.width / canvas.height
      );
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(
        splatProgram.uniforms.radius,
        correctRadius(config.SPLAT_RADIUS / 100.0)
      );
      blit(velocity!.write);
      velocity!.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye!.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2]);
      blit(dye!.write);
      dye!.swap();
    }

    function correctRadius(radius: number) {
      if (!canvas) throw new Error("Canvas not initialized");
      let aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }

    function updatePointerDownData(
      pointer: {
        id: number;
        texcoordX: number;
        texcoordY: number;
        prevTexcoordX: number;
        prevTexcoordY: number;
        deltaX: number;
        deltaY: number;
        down: boolean;
        moved: boolean;
        color: number[];
      },
      id: number,
      posX: number,
      posY: number
    ) {
      pointer.id = id;
      pointer.down = true;
      pointer.moved = false;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.color = generateColor();
    }

    function updatePointerMoveData(
      pointer: {
        id: number;
        texcoordX: number;
        texcoordY: number;
        prevTexcoordX: number;
        prevTexcoordY: number;
        deltaX: number;
        deltaY: number;
        down: boolean;
        moved: boolean;
        color: number[];
      },
      posX: number,
      posY: number,
      color: number[]
    ) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved =
        Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
      pointer.color = color;
    }

    function updatePointerUpData(pointer: {
      id: number;
      texcoordX: number;
      texcoordY: number;
      prevTexcoordX: number;
      prevTexcoordY: number;
      deltaX: number;
      deltaY: number;
      down: boolean;
      moved: boolean;
      color: number[];
    }) {
      pointer.down = false;
    }

    function correctDeltaX(delta: number) {
      let aspectRatio = canvas.width / canvas.height;
      if (aspectRatio < 1) delta *= aspectRatio;
      return delta;
    }

    function correctDeltaY(delta: number) {
      let aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) delta /= aspectRatio;
      return delta;
    }

    function generateColor() {
      let c = HSVtoRGB(Math.random(), 0.8, 1.0);
      c.r *= 0.6;
      c.g *= 0.6;
      c.b *= 0.6;
      return c;
    }

    function HSVtoRGB(h: number, s: number, v: number) {
      let r, g, b, i, f, p, q, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          r = v;
          g = t;
          b = p;
          break;
        case 1:
          r = q;
          g = v;
          b = p;
          break;
        case 2:
          r = p;
          g = v;
          b = t;
          break;
        case 3:
          r = p;
          g = q;
          b = v;
          break;
        case 4:
          r = t;
          g = p;
          b = v;
          break;
        case 5:
          r = v;
          g = p;
          b = q;
          break;
        default:
          break;
      }
      return { r, g, b };
    }

    function wrap(value: number, min: number, max: number) {
      const range = max - min;
      if (range === 0) return min;
      return ((value - min) % range) + min;
    }

    function getResolution(resolution: number) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
      else return { width: min, height: max };
    }

    function scaleByPixelRatio(input: number) {
      const pixelRatio = window.devicePixelRatio || 1;
      return Math.floor(input * pixelRatio);
    }

    function hashCode(s: string) {
      if (s.length === 0) return 0;
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    const handleMouseDown = (e: MouseEvent) => {
      let pointer = pointers[0];
      let posX = scaleByPixelRatio(e.clientX);
      let posY = scaleByPixelRatio(e.clientY);
      updatePointerDownData(pointer, -1, posX, posY);
      clickSplat(pointer);
    };

    const handleMouseMove = (e: MouseEvent) => {
      let pointer = pointers[0];
      let posX = scaleByPixelRatio(e.clientX);
      let posY = scaleByPixelRatio(e.clientY);
      let color = pointer.color;
      updatePointerMoveData(pointer, posX, posY, color);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touches = e.targetTouches;
      let pointer = pointers[0];
      for (let i = 0; i < touches.length; i++) {
        let posX = scaleByPixelRatio(touches[i].clientX);
        let posY = scaleByPixelRatio(touches[i].clientY);
        updatePointerDownData(pointer, touches[i].identifier, posX, posY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touches = e.targetTouches;
      let pointer = pointers[0];
      for (let i = 0; i < touches.length; i++) {
        let posX = scaleByPixelRatio(touches[i].clientX);
        let posY = scaleByPixelRatio(touches[i].clientY);
        updatePointerMoveData(pointer, posX, posY, pointer.color);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touches = e.changedTouches;
      let pointer = pointers[0];
      for (let i = 0; i < touches.length; i++) {
        updatePointerUpData(pointer);
      }
    };

    const handleResize = () => {
      if (resizeCanvas()) initFramebuffers();
    };

    function handleFirstMouseMove(e: MouseEvent) {
      let pointer = pointers[0];
      let posX = scaleByPixelRatio(e.clientX);
      let posY = scaleByPixelRatio(e.clientY);
      let color = generateColor();
      updateFrame(); // start animation loop
      updatePointerMoveData(pointer, posX, posY, color);
      document.body.removeEventListener("mousemove", handleFirstMouseMove);
    }

    function handleFirstTouchStart(e: TouchEvent) {
      const touches = e.targetTouches;
      let pointer = pointers[0];
      for (let i = 0; i < touches.length; i++) {
        let posX = scaleByPixelRatio(touches[i].clientX);
        let posY = scaleByPixelRatio(touches[i].clientY);
        updateFrame(); // start animation loop
        updatePointerDownData(pointer, touches[i].identifier, posX, posY);
      }
      document.body.removeEventListener("touchstart", handleFirstTouchStart);
    }

    window.addEventListener("mousedown", handleMouseDown);
    document.body.addEventListener("mousemove", handleFirstMouseMove);
    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("touchstart", handleFirstTouchStart);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove, false);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    // Add automatic splats for background animation
    const autoSplat = () => {
      const { r = 0, g = 0, b = 0 } = generateColor();
      const color = [r * 1.2, g * 1.2, b * 1.2];
      const x = Math.random();
      const y = Math.random();
      const dx = (Math.random() - 0.5) * 25;
      const dy = (Math.random() - 0.5) * 25;
      splat(x, y, dx, dy, color);
    };

    const autoSplatInterval = setInterval(autoSplat, 2000);

    updateFrame();

    // Cleanup event listeners and animation frames
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      clearInterval(autoSplatInterval);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    SIM_RESOLUTION,
    DYE_RESOLUTION,
    CAPTURE_RESOLUTION,
    DENSITY_DISSIPATION,
    VELOCITY_DISSIPATION,
    PRESSURE,
    PRESSURE_ITERATIONS,
    CURL,
    SPLAT_RADIUS,
    SPLAT_FORCE,
    SHADING,
    COLOR_UPDATE_SPEED,
    BACK_COLOR,
    TRANSPARENT,
  ]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <canvas ref={canvasRef} id="fluid" className="w-full h-full" />
    </div>
  );
}

export { SplashCursor };
