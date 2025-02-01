// ChromaKeyShader.ts
interface ChromaKeyConfig {
	width: number;
	height: number;
	keyColor?: [number, number, number];
	similarity?: number;
	smoothness?: number;
	spill?: number;
}

export interface WebGLContext {
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	vao: WebGLVertexArrayObject;
	texture: WebGLTexture;
	uniforms: Record<string, WebGLUniformLocation>;
	buffer: WebGLBuffer;
	destroy: () => void;
}

export const createChromaKeyShader = ({
	width,
	height,
	keyColor = [0.0, 1.0, 0.0],
	similarity = 0.35,
	smoothness = 0.06,
	spill = 0.35,
}: ChromaKeyConfig) => {
	// Vertex shader source
	const vertexShaderSource = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
          gl_Position = vec4(a_position, 0, 1);
          v_texCoord = a_texCoord;
        }`;

	// Fragment shader source
	const fragmentShaderSource = `#version 300 es
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec3 u_keyColor;
        uniform float u_similarity;
        uniform float u_smoothness;
        uniform float u_spill;
        in vec2 v_texCoord;
        out vec4 fragColor;
    
        void main() {
          vec4 texColor = texture(u_image, v_texCoord);
          vec3 rgb = texColor.rgb;
    
          vec3 delta = rgb - u_keyColor;
          float dist = length(delta);
          
          float alpha = smoothstep(u_similarity - u_smoothness, u_similarity + u_smoothness, dist);
    
          if (dist < u_similarity + u_smoothness) {
            float spillVal = 1.0 - smoothstep(0.0, u_similarity + u_smoothness, dist);
            float greenSpill = max(0.0, rgb.g - ((rgb.r + rgb.b) * 0.5));
            rgb.g -= greenSpill * spillVal * u_spill;
          }
    
          fragColor = vec4(rgb, alpha);
        }`;

	return {
		initGL: (canvas: HTMLCanvasElement): WebGLContext => {
			const gl = canvas.getContext('webgl2', {
				powerPreference: 'high-performance',
				antialias: false,
				alpha: true,
				premultipliedAlpha: false,
				depth: false,
				stencil: false,
				preserveDrawingBuffer: false,
				desynchronized: true,
				failIfMajorPerformanceCaveat: false,
			});

			if (!gl) throw new Error('WebGL2 not supported');

			console.log('WebGL Renderer:', gl.getParameter(gl.RENDERER));
			console.log('WebGL Version:', gl.getParameter(gl.VERSION));
			console.log('WebGL Vendor:', gl.getParameter(gl.VENDOR));
			// Create shaders
			const vertexShader = createShader(
				gl,
				vertexShaderSource,
				gl.VERTEX_SHADER,
			);
			const fragmentShader = createShader(
				gl,
				fragmentShaderSource,
				gl.FRAGMENT_SHADER,
			);
			const program = createProgram(gl, vertexShader, fragmentShader);

			// Create VAO
			const vao = gl.createVertexArray();
			if (!vao) throw new Error('Failed to create vertex array object');
			gl.bindVertexArray(vao);

			// Create vertices
			const vertices = new Float32Array([
				-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0,
			]);

			// Create buffer
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error('Failed to create buffer');
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

			// Set up attributes
			const stride = 4 * 4;
			const positionLoc = gl.getAttribLocation(program, 'a_position');
			const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');

			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, stride, 0);
			gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, stride, 2 * 4);
			gl.enableVertexAttribArray(positionLoc);
			gl.enableVertexAttribArray(texCoordLoc);

			// Create and configure texture
			const texture = gl.createTexture();
			if (!texture) throw new Error('Failed to create texture');
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

			// Set up uniforms
			const uniforms = {
				keyColor: gl.getUniformLocation(program, 'u_keyColor'),
				similarity: gl.getUniformLocation(program, 'u_similarity'),
				smoothness: gl.getUniformLocation(program, 'u_smoothness'),
				spill: gl.getUniformLocation(program, 'u_spill'),
				image: gl.getUniformLocation(program, 'u_image'),
			} as Record<string, WebGLUniformLocation>;

			// Initialize uniforms
			gl.useProgram(program);
			gl.uniform3fv(uniforms.keyColor, keyColor);
			gl.uniform1f(uniforms.similarity, similarity);
			gl.uniform1f(uniforms.smoothness, smoothness);
			gl.uniform1f(uniforms.spill, spill);
			gl.uniform1i(uniforms.image, 0);

			// Configure blending
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(
				gl.SRC_ALPHA,
				gl.ONE_MINUS_SRC_ALPHA,
				gl.ONE,
				gl.ONE_MINUS_SRC_ALPHA,
			);
			gl.blendEquation(gl.FUNC_ADD);

			// Disable unnecessary features
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);

			// Configure pixel storage
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

			// Set viewport
			gl.viewport(0, 0, width, height);

			return {
				gl,
				program,
				vao,
				texture,
				uniforms,
				buffer,
				destroy: () => {
					gl.deleteBuffer(buffer);
					gl.deleteTexture(texture);
					gl.deleteProgram(program);
					gl.deleteVertexArray(vao);
				},
			};
		},
	};
};

function createShader(
	gl: WebGL2RenderingContext,
	source: string,
	type: number,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Failed to create shader');

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compile error: ${info}`);
	}

	return shader;
}

function createProgram(
	gl: WebGL2RenderingContext,
	vertexShader: WebGLShader,
	fragmentShader: WebGLShader,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error('Failed to create program');

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program link error: ${info}`);
	}

	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	return program;
}
