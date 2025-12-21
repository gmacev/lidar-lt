export const pointSizeVS = `
precision highp float;

attribute vec3 aVertexPosition;
attribute vec4 aVertexColour;
attribute vec3 aNormal;

uniform mat4 uWorld;
uniform mat4 uView;
uniform mat4 uProj;

uniform float uPointSizeMultiplicator;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform vec3 uLightPos;

varying vec3 vVertexColour;

void main(void){
	vec4 worldPos = uWorld * vec4(aVertexPosition, 1.0);
	vec4 pos = uView * worldPos;
	
	// calculate point size depending on the distance from viewport
	// or rather: take a point in view space, translate it by {trans} along the x and y axis
	// and then calculate the translated distance in projected space.  
	// this distance, multiplied by a user defined factor, gives the desired point size.
	float trans = 0.5 + max(length(pos)-10.0, 0.0) / 30.0;
	vec4 p1 = uProj * pos;
	vec4 p2 = uProj * (pos + vec4(trans,trans,0.0,0.0));
	p1.xyz = p1.xyz / p1.w;
	p2.xyz = p2.xyz / p1.w;
	vec2 dist = p1.xy - p2.xy;
	float ps = length(dist) * 30.0;
	ps = max(3.0, ps);
	ps = ps * uPointSizeMultiplicator;
	
	// Shadow calculation
	vec4 shadowPos = uShadowMatrix * worldPos;
	vec3 shadowCoord = shadowPos.xyz / shadowPos.w;
	shadowCoord = shadowCoord * 0.5 + 0.5;

	float shadow = 0.0;
	if (shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 && shadowCoord.z >= 0.0 && shadowCoord.z <= 1.0) {
		float depth = texture2D(uShadowMap, shadowCoord.xy).r;
		float bias = 0.0001;
		if (depth < shadowCoord.z - bias) {
			shadow = 1.0;
		}
	}

	gl_PointSize = ps;
	gl_Position = uProj * pos;
	
	vec3 color = aVertexColour.xyz / 256.0;
	// Apply shadow darkening
	if (shadow > 0.5) {
		color = vec3(1.0, 0.0, 0.0); // DEBUG: RED SHADOWS
	} else {
	    // DEBUG: Visualize light/not-shadow to ensure shader is updating
	    // color.b += 0.2; 
	}
	vVertexColour = color;
}
`;

export const fixedPointSizeVS = `
precision highp float;

attribute vec3 aVertexPosition;
attribute vec4 aVertexColour;
//attribute vec3 aNormal;

uniform mat4 uWorld;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uPointSize;

varying vec3 vVertexColour;
//varying vec3 vNormal;
varying vec3 vWorldPos;
// vDepth.x:	The linear depth. 
// vDepth.y:	DepthMap depth. 
varying vec2 vDepth; 

void main(void){
	vec4 worldPos = uWorld * vec4(aVertexPosition, 1.0);
	vec4 pos = uView * worldPos;
	//vNormal = (worldPos * vec4(aNormal, 0.0)).xyz;
	vWorldPos = worldPos.xyz;
	
	gl_PointSize = uPointSize;
	gl_Position = uProj * pos;
	// DEBUG: BLUE for FixedPointSize
	vVertexColour = vec3(0.0, 0.0, 1.0);
	// vVertexColour = aVertexColour.xyz / 256.0;
	vDepth = vec2( gl_Position.w, gl_Position.z / gl_Position.w * 0.5 + 0.5 );
}
`;
