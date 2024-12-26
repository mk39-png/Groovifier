// https://threejs.org/docs/#api/en/renderers/webgl/WebGLProgram
/*
// The below variables are pre-defined by Three.js

// = object.matrixWorld
uniform mat4 modelMatrix;

= camera.matrixWorldInverse * object.matrixWorld
uniform mat4 modelViewMatrix;

// = camera.projectionMatrix
uniform mat4 projectionMatrix;

// = camera.matrixWorldInverse
uniform mat4 viewMatrix;

// = inverse transpose of modelViewMatrix
uniform mat3 normalMatrix;

// = camera position in world space
uniform vec3 cameraPosition;

// default vertex attributes provided by BufferGeometry
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
*/

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    vPosition = position;
    vNormal = normal;
    vUv = uv;
}
