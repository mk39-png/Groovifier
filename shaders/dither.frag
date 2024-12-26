//======================
// PROJECT 3 DITHER SHADER
//======================

#define PALETTE_SIZE 16

#ifndef MODEL_MATRIX
#define MODEL_MATRIX
    // = object.matrixWorld
    uniform mat4 modelMatrix;
#endif

#ifndef MODEL_VIEW_MATRIX
#define MODEL_VIEW_MATRIX
    // uniform mat4 modelViewMatrix;
    uniform mat4 modelViewMatrix;
#endif

#ifndef PROJECTION_MATRIX
#define PROJECTION_MATRIX
    // = camera.projectionMatrix
    uniform mat4 projectionMatrix;
#endif

// #ifndef VIEW_MATRIX
// #define VIEW_MATRIX
//     // = camera.matrixWorldInverse
//     uniform mat4 viewMatrix;
// #endif

#ifndef NORMAL_MATRIX
#define NORMAL_MATRIX
    // = inverse transpose of modelViewMatrix
    uniform mat3 normalMatrix;
#endif

// #ifndef CAMERA_POSITION
// #define CAMERA_POSITION
//     // = camera position in world space
//     uniform vec3 cameraPosition;
// #endif

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 u_LightPos; // where the light is located in the scene
uniform vec3 u_AmbientLight; // the lighting from the world
uniform float u_SpecPower; // the specular "power" of the light on the model
uniform vec3 u_SpecColor; // the specular color on this model

// NOTE: Do not use u_DiffuseColor! 
// It's only there for models without a texture and that rely on the Kd data of the .mtl file.
uniform vec3 u_DiffuseColor; // Diffuse color of the model, which is basically the base color

// Specifies whether to enable dithering or not.
uniform int u_Option;

// Palette size 16 because 16-colors to match that of early-90s PCs
uniform highp vec3 u_HSL_Palette[PALETTE_SIZE];

// NEW: To deal with texture stuff
uniform sampler2D u_Texture;

// helper function for homogeneous transformation
vec3 hom_reduce(vec4 v) {
    // component-wise division of v
    return vec3(v) / v.w;
}

//--------------------------------
// COLOR SPACE CONVERSIONS
//--------------------------------

// Unfortunately, I cannot use 3 parameters for max(), so, I guess I'll have to create a separate function
// https://stackoverflow.com/questions/28006184/get-component-wise-maximum-of-vector-in-glsl
highp float max3(highp vec3 color) {
    return max(max(color.x, color.y), color.z);
}
highp float min3(highp vec3 color) {
    return min(min(color.x, color.y), color.z);
}

bool equalFloats(float num1, float num2) {
    return abs(num1 - num2) <= 1e-15;
}

// Once I implement this here, then Dither shader will become easy to work with.
highp vec3 RGBtoHSL(highp vec3 rgb) {
	// Following the sources below for the conversion.
	// The source below ended up not being that good in providing a functional implementation,
	//	 but it does have better, more descriptive variable names.
	// https://www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/

	// Though, the formula on this site is what I was primarily referencing since it has a
	//	formula that is straightforward to implement.
	// https://medium.com/swlh/converting-between-color-models-5cb7e2d12e10

	// Finally, I referred back to this source to make sure I was on the right track and
	//	to get inspiration from.
	// https://stackoverflow.com/questions/39118528/rgb-to-hsl-conversion

	highp float color_max_M = max3(rgb);	
	highp float color_min_m = min3(rgb);
	highp float chroma = color_max_M - color_min_m;

	highp float hue_prime = 0.0;
	highp float saturation = 0.0;
	highp float luminence = 0.0;

	//----- HUE -----//
	if (equalFloats(chroma, 0.0)) {
		hue_prime = 0.0;
	} 
    if (equalFloats(color_max_M, rgb.r)) {
		hue_prime = mod(((rgb.g - rgb.b) / chroma), 6.0);
	} 
    if (equalFloats(color_max_M, rgb.g)) {
		hue_prime = ((rgb.b - rgb.r) / chroma) + 2.0;
	} 
    if (equalFloats(color_max_M, rgb.b)) {
		hue_prime = ((rgb.r - rgb.g) / chroma) + 4.0;
	}

	highp float hue = 60.0 * hue_prime;

	// NOTE: Hue may be negative, so add 360 to make it positive again! 
	// Can add 360 because HSL's Hue value is circular.
	if (hue < 0.0) {
		hue += 360.0;
	}

	//----- LUMINENCE/LIGHTNESS -----//
	luminence = (color_max_M + color_min_m) / 2.0;

	//----- SATURATION -----//
	if (equalFloats(luminence, 1.0) || equalFloats(luminence, 0.0)) {
		saturation = 0.0;
	} else {
		saturation = chroma / (1.0 - abs((2.0 * luminence) - 1.0));
	}

	return vec3(hue, saturation, luminence);
}


highp vec3 HSLtoRGB(highp vec3 hsl) {
	// Referencing the formula in the website below (at least to understand what the variables stand for)
	// https://dystopiancode.blogspot.com/2012/06/hsl-rgb-conversion-algorithms-in-c.html
    float hue = hsl.x;
    float saturation = hsl.y;
    float luminence = hsl.z;
    
	// The source below actually demonstrates the whole converted from HSL to RGB a lot better.
	// Though, it doesn't name the variables, which is a shame.
	// 	https://www.js-craft.io/blog/an-introduction-to-hsl-colors-in-css/
	float chroma = (1.0 - abs((2.0 * luminence) - 1.0)) * saturation;

	// x is intermediate value for calculating r, g, b
	float x = chroma * (1.0 - abs(mod((hue / 60.0), 2.0) - 1.0));

	// m is intermediate value for calculating r, g, b baseline
	float m = luminence - (chroma / 2.0);

    // So, this makes sure that if hue is 360, which is equivalent to 
    //  0.0 && hue < 60.0, then go with this condition.
	if (((0.0 <= hue) || (hue >= 360.0)) && (hue < 60.0)) {
		return vec3(chroma, x, 0) + m;
	}
	if ((60.0 <= hue) && (hue < 120.0))  {
		return vec3(x, chroma, 0) + m;
	}
	if ((120.0 <= hue) && (hue < 180.0)) {
		return vec3(0, chroma, x) + m;
	}
	if ((180.0 <= hue) && (hue < 240.0)) {
		return vec3(0, x, chroma) + m;
	}
	if ((240.0 <= hue) && (hue < 300.0)) {
		return vec3(x, 0, chroma) + m;
	}
	if ((300.0 <= hue) && (hue < 360.0)) {
		return vec3(chroma, 0, x) + m;
	}
}


//--------------------------------
// DITHER SOURCE
//--------------------------------
// Following the tutorial below...
// http://alex-charlton.com/posts/Dithering_on_the_GPU/#fnref2

// The return values are precalculated from a Bayer 4x4 matrix.
float getIndexMatrix4x4(int idx) {
    if (idx == 0)   return 0.0;
    if (idx == 1)   return 8.0;
    if (idx == 2)   return 2.0;
    if (idx == 3)   return 10.0;
    if (idx == 4)   return 12.0;
    if (idx == 5)   return 4.0;
    if (idx == 6)   return 14.0;
    if (idx == 7)   return 6.0;
    if (idx == 8)   return 3.0;
    if (idx == 9)   return 11.0;
    if (idx == 10)  return 1.0;
    if (idx == 11)  return 9.0;
    if (idx == 12)  return 15.0;
    if (idx == 13)  return 7.0;
    if (idx == 14)  return 13.0;
    if (idx == 15)  return 5.0;
}


// Code below is super similar to the example in the source below.
// http://alex-charlton.com/posts/Dithering_on_the_GPU/#fnref2
// idxVal() gets the screen coordinate and matches it to what its dither pattern should be.
float indexValue() {
    // 2nd value of mod() corresponds to dimension of IndexMatrix (i.e. 4)
    int x = int(mod(gl_FragCoord.x, 4.0));
    int y = int(mod(gl_FragCoord.y, 4.0));

    // Divide by 16.0 to normalize and for indexValue() to work later with out normalized distance hueDiff
    return getIndexMatrix4x4((x + y * 4)) / 16.0;
} 


// Used to find the minimum absolute distance between two hues...
// So, distance around the hue circle and gets whatever distance is the closest (either clockwise or counterclockwise)
// Assuming that hue is 0 to 360, not normalized...
float hueDistance(float h1, float h2) {
    float diff1 = abs(h1 - h2);
    float diff2 = abs(360.0 - abs(h1 - h2));

    return min(diff1, diff2);
}


// So, unlike the source below, I combineSd closestColors() with dither() because GLSL ES 2.0 does NOT like vec3[2]
// http://alex-charlton.com/posts/Dithering_on_the_GPU/#fnref2SSSSSSSSS
vec3 dither(vec3 rgb) {
    vec3 hsl = RGBtoHSL(rgb);
    float hue = hsl.x;

    // Hue set to -720 as a placeholder for the lowest value
    vec3 closest = vec3(-720.0, 0 ,0);
    vec3 secondClosest = vec3(-720.0, 0 ,0);

    vec3 temp;

    for (int i = 0; i < PALETTE_SIZE; ++i) {
        temp = u_HSL_Palette[i];
        
        // So, getting distance from hue of current color to that of the first color in the palette
        float tempDistance = hueDistance(temp.x, hue);

        // Below if statements then used to determine the values of closest and secondClosest
        //  depending on their distance to the current color.
        // And matching them with the current color of the color palette that we're on.
        if (tempDistance < hueDistance(closest.x, hue)) {
            secondClosest = closest;
            closest = temp;
        } else {
            if (tempDistance < hueDistance(secondClosest.x, hue)) {
                secondClosest = temp;
            }
        }
    }

    float threshold = indexValue(); 

    // This should work fine w/ our [0 to 360] rather than [0 to 1] hue space
    float hueDiff = hueDistance(hue, closest.x) / hueDistance(secondClosest.x, closest.x);

    // Now, with the two normalized values, compare and see whether to use closest or secondClosest colors
    return HSLtoRGB(hueDiff < threshold ? closest : secondClosest);
}


void main() {
    // https://threejs.org/docs/#api/en/cameras/Camera.matrixWorldInverse
    // So, worldNormal converts the model-space normals into world-space normals.
    vec3 worldNormal = normalize(mat3(modelMatrix) * normalize(vNormal));

    // cameraNormal takes the model-space normals into view-space normals
    vec3 cameraNormal = normalize(normalMatrix * normalize(vNormal));
    
    // Calculate the position of a vertex in the vertex shader
    // https://threejs.org/docs/#api/en/renderers/webgl/WebGLProgram
    // vertexWorldPosition converts vertex positions from model space to world space
    vec3 vertexWorldPosition = hom_reduce(modelMatrix * vec4(vPosition, 1.0));

    // vertexViewPosition convertes vertex positions from world space to view space
    vec3 vertexViewPosition = hom_reduce(viewMatrix * vec4(vertexWorldPosition, 1.0));

    //============= 
    // DIFFUSE CALC
    //============= 

    // calculate diffuse based on light world position and normal world position
    float diffuse = dot(normalize(u_LightPos), worldNormal);

    //============== 
    // SPECULAR CALC
    //============== 

    // Calculating specular highlight based on light world position and vertex world position
    vec3 lightDirection = normalize(u_LightPos - vertexWorldPosition);

    // cameraLightDirection based on camera view space and light direction in world space.
    //  This way, the highlight is based on where the camera is looking at the object,
    //   as well as the direction of the light from the model.
    vec3 cameraLightDirection = normalize(mat3(viewMatrix) * lightDirection);

    // Now, get the direction to the camera, noting that the camera is at 0, 0, 0 in camera space
    vec3 vertexCameraDirection = normalize(-vertexViewPosition);

    // Blinn calculation
    vec3 halfwayDir = normalize(cameraLightDirection + vertexCameraDirection);

    // angle between camera view normal and reflected light direction
    float angle = max(dot(cameraNormal, halfwayDir), 0.0);

    float specular = pow(angle, u_SpecPower);

    //========================
    // FINAL COLOR + DITHERING
    //========================

    vec3 texColor = texture2D(u_Texture, vUv).rgb;
    vec3 tempColor = (u_AmbientLight - 0.9 + diffuse) * texColor + specular * u_SpecColor;  

    if (u_Option == 0) {
        gl_FragColor = vec4(tempColor, 1.0);
    }
    if (u_Option == 1) {
        gl_FragColor = vec4(dither(tempColor), 1.0);
    }
}