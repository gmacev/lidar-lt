import type { ProfileSample } from '@/features/Viewer/hooks/useProfileData';

interface ViewBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

interface PlotBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface ProfilePointRenderOptions {
    sample: ProfileSample;
    bounds: ViewBounds;
    plot: PlotBounds;
    width: number;
    height: number;
    dpr: number;
    colorMin: number;
    colorMax: number;
    classificationVisibility: Uint8Array;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_visible;

uniform vec4 u_bounds;
uniform vec4 u_plot;
uniform vec2 u_resolution;
uniform vec2 u_color_range;
uniform float u_point_size;

varying float v_elevation;

void main() {
    if (a_visible < 0.5) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = 0.0;
        v_elevation = 0.0;
        return;
    }

    float x_range = max(0.000001, u_bounds.y - u_bounds.x);
    float y_range = max(0.000001, u_bounds.w - u_bounds.z);
    float normalized_x = (a_position.x - u_bounds.x) / x_range;
    float normalized_y = (a_position.y - u_bounds.z) / y_range;

    vec2 pixel = vec2(
        u_plot.x + normalized_x * u_plot.z,
        u_plot.y + (1.0 - normalized_y) * u_plot.w
    );
    vec2 clip = vec2(
        pixel.x / u_resolution.x * 2.0 - 1.0,
        1.0 - pixel.y / u_resolution.y * 2.0
    );

    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = u_point_size;
    v_elevation = clamp(
        (a_position.y - u_color_range.x) /
            max(0.000001, u_color_range.y - u_color_range.x),
        0.0,
        1.0
    );
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying float v_elevation;

vec3 elevation_color(float value) {
    const vec3 c0 = vec3(0.231, 0.322, 0.545);
    const vec3 c1 = vec3(0.129, 0.569, 0.549);
    const vec3 c2 = vec3(0.369, 0.788, 0.384);
    const vec3 c3 = vec3(0.992, 0.906, 0.145);
    const vec3 c4 = vec3(1.000, 0.690, 0.000);
    const vec3 c5 = vec3(0.937, 0.424, 0.259);

    float scaled = clamp(value, 0.0, 0.99999) * 5.0;
    if (scaled < 1.0) return mix(c0, c1, scaled);
    if (scaled < 2.0) return mix(c1, c2, scaled - 1.0);
    if (scaled < 3.0) return mix(c2, c3, scaled - 2.0);
    if (scaled < 4.0) return mix(c3, c4, scaled - 3.0);
    return mix(c4, c5, scaled - 4.0);
}

void main() {
    gl_FragColor = vec4(elevation_color(v_elevation), 0.82);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

    gl.deleteShader(shader);
    return null;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    gl.deleteProgram(program);
    return null;
}

function getUniform(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    name: string
): WebGLUniformLocation | null {
    return gl.getUniformLocation(program, name);
}

export class ProfilePointRenderer {
    readonly canvas: HTMLCanvasElement;

    private readonly gl: WebGLRenderingContext;
    private readonly program: WebGLProgram;
    private readonly positionBuffer: WebGLBuffer;
    private readonly visibilityBuffer: WebGLBuffer;
    private readonly positionLocation: number;
    private readonly visibilityLocation: number;
    private readonly boundsLocation: WebGLUniformLocation;
    private readonly plotLocation: WebGLUniformLocation;
    private readonly resolutionLocation: WebGLUniformLocation;
    private readonly colorRangeLocation: WebGLUniformLocation;
    private readonly pointSizeLocation: WebGLUniformLocation;
    private uploadedPosition: Float32Array | null = null;
    private visibilityMask = new Uint8Array(256);
    private pointCount = 0;

    static create(canvas: HTMLCanvasElement): ProfilePointRenderer | null {
        const options: WebGLContextAttributes = {
            alpha: true,
            antialias: false,
            depth: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
        };
        const gl = (canvas.getContext('webgl', options) ??
            canvas.getContext('experimental-webgl', options)) as WebGLRenderingContext | null;
        if (!gl) return null;

        const program = createProgram(gl);
        const positionBuffer = gl.createBuffer();
        const visibilityBuffer = gl.createBuffer();
        if (!program || !positionBuffer || !visibilityBuffer) {
            if (program) gl.deleteProgram(program);
            if (positionBuffer) gl.deleteBuffer(positionBuffer);
            if (visibilityBuffer) gl.deleteBuffer(visibilityBuffer);
            return null;
        }

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const visibilityLocation = gl.getAttribLocation(program, 'a_visible');
        const boundsLocation = getUniform(gl, program, 'u_bounds');
        const plotLocation = getUniform(gl, program, 'u_plot');
        const resolutionLocation = getUniform(gl, program, 'u_resolution');
        const colorRangeLocation = getUniform(gl, program, 'u_color_range');
        const pointSizeLocation = getUniform(gl, program, 'u_point_size');
        if (
            positionLocation < 0 ||
            visibilityLocation < 0 ||
            !boundsLocation ||
            !plotLocation ||
            !resolutionLocation ||
            !colorRangeLocation ||
            !pointSizeLocation
        ) {
            gl.deleteProgram(program);
            gl.deleteBuffer(positionBuffer);
            gl.deleteBuffer(visibilityBuffer);
            return null;
        }

        return new ProfilePointRenderer(
            canvas,
            gl,
            program,
            positionBuffer,
            visibilityBuffer,
            positionLocation,
            visibilityLocation,
            boundsLocation,
            plotLocation,
            resolutionLocation,
            colorRangeLocation,
            pointSizeLocation
        );
    }

    private constructor(
        canvas: HTMLCanvasElement,
        gl: WebGLRenderingContext,
        program: WebGLProgram,
        positionBuffer: WebGLBuffer,
        visibilityBuffer: WebGLBuffer,
        positionLocation: number,
        visibilityLocation: number,
        boundsLocation: WebGLUniformLocation,
        plotLocation: WebGLUniformLocation,
        resolutionLocation: WebGLUniformLocation,
        colorRangeLocation: WebGLUniformLocation,
        pointSizeLocation: WebGLUniformLocation
    ) {
        this.canvas = canvas;
        this.gl = gl;
        this.program = program;
        this.positionBuffer = positionBuffer;
        this.visibilityBuffer = visibilityBuffer;
        this.positionLocation = positionLocation;
        this.visibilityLocation = visibilityLocation;
        this.boundsLocation = boundsLocation;
        this.plotLocation = plotLocation;
        this.resolutionLocation = resolutionLocation;
        this.colorRangeLocation = colorRangeLocation;
        this.pointSizeLocation = pointSizeLocation;
    }

    private uploadSample(sample: ProfileSample) {
        if (sample.packedPosition === this.uploadedPosition) return;

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sample.packedPosition, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.visibilityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(sample.count), gl.DYNAMIC_DRAW);

        this.uploadedPosition = sample.packedPosition;
        this.visibilityMask.fill(2);
        this.pointCount = sample.count;
    }

    private uploadVisibility(sample: ProfileSample, classificationVisibility: Uint8Array) {
        let changed = classificationVisibility.length !== this.visibilityMask.length;
        if (!changed) {
            for (let i = 0; i < classificationVisibility.length; i++) {
                if (classificationVisibility[i] !== this.visibilityMask[i]) {
                    changed = true;
                    break;
                }
            }
        }
        if (!changed) return;

        const visibility = new Uint8Array(sample.count);
        for (let i = 0; i < sample.count; i++) {
            visibility[i] = classificationVisibility[sample.classification[i]] ? 255 : 0;
        }

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.visibilityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, visibility, gl.DYNAMIC_DRAW);
        this.visibilityMask = classificationVisibility.slice();
    }

    render({
        sample,
        bounds,
        plot,
        width,
        height,
        dpr,
        colorMin,
        colorMax,
        classificationVisibility,
    }: ProfilePointRenderOptions) {
        const pixelWidth = Math.max(1, Math.floor(width * dpr));
        const pixelHeight = Math.max(1, Math.floor(height * dpr));
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        }

        const gl = this.gl;
        gl.viewport(0, 0, pixelWidth, pixelHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (sample.count === 0) return;

        this.uploadSample(sample);
        this.uploadVisibility(sample, classificationVisibility);

        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.visibilityBuffer);
        gl.enableVertexAttribArray(this.visibilityLocation);
        gl.vertexAttribPointer(this.visibilityLocation, 1, gl.UNSIGNED_BYTE, true, 0, 0);

        gl.uniform4f(this.boundsLocation, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
        gl.uniform4f(
            this.plotLocation,
            plot.left * dpr,
            plot.top * dpr,
            plot.width * dpr,
            plot.height * dpr
        );
        gl.uniform2f(this.resolutionLocation, pixelWidth, pixelHeight);
        gl.uniform2f(this.colorRangeLocation, colorMin, colorMax);
        gl.uniform1f(this.pointSizeLocation, Math.max(1.5, 1.45 * dpr));

        const scissorLeft = Math.max(0, Math.floor(plot.left * dpr));
        const scissorBottom = Math.max(0, Math.floor(pixelHeight - (plot.top + plot.height) * dpr));
        const scissorWidth = Math.min(
            pixelWidth - scissorLeft,
            Math.max(1, Math.ceil(plot.width * dpr))
        );
        const scissorHeight = Math.min(
            pixelHeight - scissorBottom,
            Math.max(1, Math.ceil(plot.height * dpr))
        );

        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(scissorLeft, scissorBottom, scissorWidth, scissorHeight);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, this.pointCount);
        gl.disable(gl.BLEND);
        gl.disable(gl.SCISSOR_TEST);
    }

    dispose() {
        const gl = this.gl;
        gl.deleteBuffer(this.positionBuffer);
        gl.deleteBuffer(this.visibilityBuffer);
        gl.deleteProgram(this.program);
    }
}
