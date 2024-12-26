// CS 351 - Project 03
// Northwestern University | Fall 2024

// Referenced the code from below for implementation of orignal scene in three.js
// https://github.com/mrdoob/three.js/blob/master/examples/webgl_loader_obj_mtl.html

// Referencing below source to quickly create three.js custom material
// https://medium.com/@pailhead011/writing-glsl-with-three-js-part-1-1acb1de77e5c

import { audio_processor } from "../lib/my-utils/process-audio.js";
import { setup_input_listeners, sum } from "../lib/my-utils/app-helpers.js";
import { load_shader } from "../lib/my-utils/load-shader.js";
import { process_image_palette } from "../lib/my-utils/process-image-palette.js";
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

//-----------------------------------------
// GLOBAL VARIABLES (well, global to app.js)
//-----------------------------------------
// Variables for audio functionality 
const g_file = await audio_processor();
setup_input_listeners(); // Add listeners for user input

const g_histogram_canvas = document.getElementById("histogram");
const g_histogram_ctx = g_histogram_canvas.getContext("2d");

// Global reference to the webGL context and canvas
const g_webgl_canvas = document.getElementById('webgl');
const g_renderer = new THREE.WebGLRenderer({antialias: true, canvas: g_webgl_canvas});
const g_scene = new THREE.Scene();

// https://threejs.org/docs/#api/en/math/Matrix4.transpose
// Cameras have the inverse transpose stuff and whatnot.
const g_camera = new THREE.PerspectiveCamera( 55, g_webgl_canvas.width / g_webgl_canvas.height, 0.1, 2000);
const g_controls = new OrbitControls( g_camera, g_renderer.domElement );
const g_clock = new THREE.Clock();

// This is used to extract the texture name from the map_kd section of a .mtl file.
// i.e. ../textures/whale_texture.png would get you whale_texture.png
const imgNameRegex = /([^/]+)$/;

// These below will be used to hold references to the scene meshes for easier access 
//  for transformations like tranlations, rotations, and scaling.
// Holding a reference to all the models in a scene for transformations
const g_models_ref = new Map();

// This will hold all the materials references so that shader uniforms can be easily changed.
const g_materials_map = new Map();

// The below are for audio interaction!
//----- Global function variables (for the model) -----\\
// NOTE: we have this variable out here so that we can update it globally for all parts of the assembly
window.g_rotation_axis = [0, 1, 0];
window.g_rotation_speed = 0.01; // This adjusts the rotation speed of the scene.
window.g_whale_scale = 1.0;
window.g_fin_scale = 1.0;

//----- USED FOR AUDIO INTERACTIVITY -----//
// The prev is used to store the difference between the old buffer and new buffer of the audio for a given frequency range.
// This is then used to determine the speed of rotation.
// NOTE: Below are needed or else audio functionality will have NaNs, which would make the models vanish
window.low_freq_prev = 0.0;    
window.mid_low_freq_prev = 0.0;    
window.mid_high_freq_prev = 0.0;    
window.high_freq_prev = 0.0;    

//----- DITHERING OPTION -----//
window.ditherEnable = false;

main();

async function main() {
    //=====================================
    // scene setup
    //=====================================
    g_renderer.setSize( g_webgl_canvas.width, g_webgl_canvas.height );
    g_renderer.setAnimationLoop( animate );

    g_scene.add( g_camera );

    var grid = new THREE.GridHelper( 20, 100, '#1ae68c', '#1ae68c' );
    g_scene.add(grid);

    process_image_palette("resources/textures/sara-98b-1x.png");
    window.g_hsl_palette = [180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5];

    //=====================================
    // shader material setup
    //=====================================
    const VSHADER_DITHER_SOURCE = await load_shader("shaders/dither.vert");
    const FSHADER_DITHER_SOURCE = await load_shader("shaders/dither.frag");

    //=====================================
    // .obj and .mtl loading
    //=====================================
    // Loading .mtl with .obj to make code neater.
    const obj_loader = new OBJLoader();
    const mtl_loader = new MTLLoader();

    // Defining functions used for .load() functions
    const onProgress = function (xhr) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    }
    const onError = function (error) {
        console.log(error.message);
    }

    // This just includes the base name.
    let models_files_list = ['astronaut_textured', 'inner_ring', 'outer_ring', 'whale_textured'];

    // Load material first!
    // NOTE: This current implementation assumes that the .mtl specifies 1 singular material.
    // If there are multiple materials in the .mtl, then this will fail.
    models_files_list.forEach((model_name) => {
        
        // NOTE: Load the .mtl first so that the shader has all of its necessary uniforms from the .mtl file
        mtl_loader.load(
            // resource URL
            `resources/models/${model_name}.mtl`,

            // Called when .mtl is loaded
            function ( material ) {
                // The [0] access below works by assuming that the .mtl file specifies only 1 material.
                const material_info = Object.values(material.materialsInfo)[0];

                const textureFileName = imgNameRegex.exec(material_info['map_kd'])[0];

                // NOTE: If material already exists, then there will NOT be a duplicate.
                // Also, as the mesh is loaded in, it will be assigned the non-duplicated material.
                // TL;DR: There shouldn't be any problems with duplicate materials in g_materials_map.
                const scene_material = new THREE.ShaderMaterial({
                    uniforms: 
                    {
                        "u_AmbientLight":    {value : material_info['ka']}, // ambient aka Ka 

                        // Diffuse color can be undefined for .obj that use textures. 
                        // So, conditional is here to make sure that models are assigned a default diffuse color.
                        "u_DiffuseColor":    {value : (material_info['kd'] ? material_info['kd'] : [1.0, 0.0, 0.0])}, // diffuse aka Kd
                        
                        "u_SpecColor":       {value : material_info['ks']}, // specular aka Ks

                        // Default uniforms below for all models using this material
                        "u_LightPos":        {value : [0, 1, 2]},

                        // NOTE: Using the whale_texture.png as a placeholder texture for models that 
                        //  do not have an associated image texture
                        "u_Texture":         {value : (material_info['map_kd'] ? 
                                                        new THREE.TextureLoader().load(`resources/textures/${textureFileName}`) : // if map_kd exists in .mtl, then use that texture name 
                                                        new THREE.TextureLoader().load('resources/textures/whale_texture.png')) }, // else, use a default placeholder texture....
                        "u_SpecPower":       {value : 32.0},
                        "u_Option":          {value : 5},
                        "u_HSL_Palette":     {value : [180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5, 180, 1.0, 0.5] },
                    },

                    vertexShader: VSHADER_DITHER_SOURCE,
                    fragmentShader: FSHADER_DITHER_SOURCE,
                });

                // Add scene_material to a map!
                g_materials_map.set(material_info["name"], scene_material);

                // material.materialsInfo object gives the parsed data from the .mtl file!
                // So, that would be the name of the material and its properties
                // material.materialsInfo.detail would give us the ns, ka, kd, etc.
                obj_loader.load(
                    // resource URL
                    `resources/models/${model_name}.obj`,

                    // called when .obj is loaded
                    function ( object ) {
                        
                        // Before adding it to the scene, name it!
                        object.name = model_name;

                        // Setting the models to remember for access in animate()
                        g_models_ref.set(object.name, object);

                        // Setting default starting positions for the whale and astronaut meshes
                        if (model_name.includes("whale")) {
                            const fin_left_ref = object.children[1];
                            const fin_right_ref = object.children[2];

                            fin_left_ref.position.set(-0.15, -0.075, 0.0);
                            fin_right_ref.position.set(0.15, -0.075, 0.0);
                        }

                        g_scene.add( object );

                        // Utilizing the Three.js code for parsing .obj since it's much neater.
                        // Also, Three.js has greater quality of life features.
                        // https://stackoverflow.com/questions/70387803/how-to-add-custom-shadermaterial-to-an-obj-3d-object-in-three-js
                        // loops through the names of the materials and reassign the new custom dither shader material!
                        object.traverse( function (child) {
                            if ( child instanceof THREE.Mesh ) {
                                child.material = g_materials_map.get(child.material.name);
                            }
                        });
                    },

                    // Called as .mtl is loading
                    onProgress,
                    // Worst case scenario, loading somehow fails
                    onError
                );
            });
            }, 
            
            // Called as .mtl is loading
            onProgress,
            // Worst case scenario, loading somehow fails
            onError
    );

    //=====================================
    // camera interaction and movement
    //=====================================
    g_camera.position.set(0, 1, -3);
    g_camera.lookAt(0, 0, 0);

    // https://threejs.org/docs/#examples/en/controls/OrbitControls
    g_controls.minDistance = 0.01;
    g_controls.maxDistance = 100;
    
    g_controls.autoRotate = true;
    g_controls.autoRotateSpeed = 2.0;

    g_controls.enablePan = false;
    g_controls.screenSpacePanning = false;
    g_controls.listenToKeyEvents(document.body);
    g_controls.keys = {
        LEFT: 'KeyA', 
        UP: 'KeyW',
        RIGHT: 'KeyD',
        BOTTOM: 'KeyS'
    }
    g_controls.enableDamping = true;
    g_controls.zoomSpeed = 10.0;
}

function animate( time ) {
    g_renderer.setClearColor(new THREE.Color(Math.cos(time / 1000), 0.4, 0.4), 1.0);
    g_controls.update( g_clock.getDelta() );

    const g_astronaut_ref = g_models_ref.get("astronaut_textured");
    const g_inner_ring_ref = g_models_ref.get("inner_ring");
    const g_outer_ring_ref = g_models_ref.get("outer_ring");
    const g_whale_ref = g_models_ref.get("whale_textured");

    // If the user has inputted a song, then we do some funky adjustments according to the analysis of the song's elements.
    // This if statement is true when we initially put in an audio file to analyze 
    // So, if g_dataArray is NOT null (i.e. user has passed in an audio file that's been analyzed), 
    //  then we can use it for our calculation of the whale scale.
    // So, if you want to know what values are passed back, check process-audio.js
    // When audio has been loaded and when all of the models are defined in the scene,
    //  then do model transformations.
    if (g_file.audioAnalyses && g_astronaut_ref && g_inner_ring_ref && g_outer_ring_ref && g_whale_ref) {

        // Extact the things from the essentia audio analysis.
        const bpm = g_file.audioAnalyses['bpm'];
        const confidence = g_file.audioAnalyses['confidence'];
        const danceability = g_file.audioAnalyses['danceability'];
        const energy = g_file.audioAnalyses['danceability'];
        const dynamicComplexity = g_file.audioAnalyses['danceability'];
        const loudness = g_file.audioAnalyses['loudness'];
        const g_analyser = g_file.audioAnalyses['g_analyser']; // NOTE: Keep g_analyser here as we want the analysis to keep updating as the audio plays!
        const dataArray = g_file.audioAnalyses['dataArray']; // This is where we store the byteFrequencyData from g_analyser at a given moment as the song is playing.
        
        // Now, we actually fill in the g_dataArray based on the analyzer
        g_analyser.getByteFrequencyData(dataArray);
        const bufferLength = g_analyser.frequencyBinCount;

        //----- FREQUENCY HISTOGRAM UPDATING -----//
        // The fillStyle and fillRect is to define the background color of the histogram,
        //  which we want to be blank/transparent.
        g_histogram_ctx.clearRect(0, 0, g_histogram_canvas.width, g_histogram_canvas.height);
        g_histogram_ctx.fillStyle = "rgba(0.0, 0.0, 0.0, 0.5)";
        g_histogram_ctx.fillRect(0, 0, g_histogram_canvas.width, g_histogram_canvas.height);

        // barWidth's size by scaling the bars relative to the size of the histogram canvas by
        //  dividing the width of the histogram depending on the bufferLength.
        // Then, the number of bars is determined by the number at the end.
        //  so, right now, it would be bufferLength / 2.0, which is 64 bars.
        const barWidth = (g_histogram_canvas.width / bufferLength) * 2.0;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            g_histogram_ctx.fillStyle = `rgb(102 102 ${barHeight + 100})`;
            g_histogram_ctx.fillRect(x, g_histogram_canvas.height - barHeight / 2, barWidth, barHeight / 2);
            x += barWidth + 1; // 1-pixel gap between bars
        }

        //----- SCENE TRANSFORMATIONS UPDATING -----//
        // Now, instead of using the g_dataArray for the bars of a histogram, 
        //  we grab the magnitude of each bar, sum them up, and use that single number for our calculations.
        // size = 128
        // width = 128/4
        const chunk = (dataArray.length / 4);
        let low_freq = dataArray.slice(0, chunk);   // low for the whale
        let mid_low_freq = dataArray.slice(chunk, chunk * 2); // med_low for the astronaut
        let mid_high_freq = dataArray.slice(chunk * 2, chunk * 3); // med_high for the inner ring
        let high_freq = dataArray.slice(chunk * 3, chunk * 4); // high for the outer ring

        // The function for s1 below is the best IMHO
        const divvy = energy / (bpm * confidence * danceability * Math.abs(loudness))
        let s1 = 0.9 * (confidence * (low_freq.reduce(sum) * divvy)); // this is for the whale
        let s2 = 0.1 + confidence * (mid_low_freq.reduce(sum) / 1000); // this is for the astronaut
        let s3 = 0.1 + confidence * (mid_high_freq.reduce(sum) / 1000); // this is for the inner ring
        let s4 = 0.1 + confidence * (high_freq.reduce(sum) / 1000); // this is for the outermost ring

        // .scale() on g_camera_matrix scales the position of the camera relative to the origin. 
        //  This creates a sort of "zooming" effect onto the object in the center.
        const low_freq_delta = (Math.abs(window.low_freq_prev - s1) * 100) / Math.abs(loudness);
        window.low_freq_prev = s1;

        const mid_low_freq_delta = (Math.abs(window.mid_low_freq_prev - s2) * 100) / Math.abs(loudness);
        window.mid_low_freq_prev = s2;

        const mid_high_freq_delta = (Math.abs(window.mid_high_freq_prev - s3) * 100) / Math.abs(loudness);
        window.mid_high_freq_prev = s3;

        const high_freq_delta = (Math.abs(window.high_freq_prev - s4) * 100) / Math.abs(loudness);
        window.high_freq_prev = s4;

        //----- BODY MOVERS -----//
        const rotation_factor = (window.g_rotation_speed * bpm * danceability) / (confidence * dynamicComplexity * Math.abs(loudness));

        g_whale_ref.rotateOnAxis(new THREE.Vector3(...window.g_rotation_axis), 0.1 + rotation_factor * low_freq_delta);

        g_whale_ref.scale.set(s1 * window.g_whale_scale, s1 * window.g_whale_scale, s1 * window.g_whale_scale);

        //----- ASTRONAUT MOVER -----//
        g_astronaut_ref.rotateOnAxis(new THREE.Vector3(1, -1, 1).normalize(), 0.1 + rotation_factor * mid_low_freq_delta);
        g_astronaut_ref.scale.set(s2, s2, s2);

        //----- RING MOVERS -----//
        g_inner_ring_ref.rotateOnAxis(new THREE.Vector3(-1, 0, 1).normalize(), 0.1 + rotation_factor * mid_high_freq_delta);
        g_inner_ring_ref.scale.set(s3, s3, s3);

        g_outer_ring_ref.rotateOnAxis(new THREE.Vector3(0, 1, 1).normalize(), 0.1 + rotation_factor * high_freq_delta);
        g_outer_ring_ref.scale.set(s4, s4, s4);

    } 
    // When audio has not been inputted, then use these for the default rotations
    else if (g_whale_ref && g_astronaut_ref && g_outer_ring_ref && g_inner_ring_ref) {
        g_whale_ref.scale.set(window.g_whale_scale, window.g_whale_scale, window.g_whale_scale);

        g_astronaut_ref.rotateOnAxis(new THREE.Vector3(1, -1, 1).normalize(), window.g_rotation_speed);
       
        g_outer_ring_ref.rotateOnAxis(new THREE.Vector3(0, 1, 1).normalize(), window.g_rotation_speed);
       
        g_inner_ring_ref.rotateOnAxis(new THREE.Vector3(-1, 0, 1).normalize(), window.g_rotation_speed);
    }

    // Dealing with the whale model and fin models rotation
    if (g_whale_ref) {
        g_whale_ref.rotateOnAxis(new THREE.Vector3(...window.g_rotation_axis).normalize(), window.g_rotation_speed);

        const g_fin_left_ref = g_whale_ref.children[1];
        const g_fin_right_ref = g_whale_ref.children[2];

        g_fin_left_ref.rotateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), window.g_rotation_speed);
        g_fin_left_ref.scale.set(window.g_fin_scale, window.g_fin_scale, window.g_fin_scale);

        g_fin_right_ref.rotateOnAxis(new THREE.Vector3(1, 0.5, 0).normalize(), window.g_rotation_speed)
        g_fin_right_ref.scale.set(window.g_fin_scale, window.g_fin_scale, window.g_fin_scale);
    }

    const ditherEnabled = document.querySelector(`#ditherize`).checked;

    // NOTE: The efficiency of this probably could be better by assigning a value to the uniform for every frame.
    if (ditherEnabled) { 
        // Change the uniform to enable dithering in the shader.
        g_materials_map.forEach((material_ref, material_name) => {
            material_ref.uniforms.u_Option.value = 1;
            material_ref.uniforms.u_HSL_Palette.value = window.g_hsl_palette;
        });
    } else {
        g_materials_map.forEach((material_ref, material_name) => {
            material_ref.uniforms.u_Option.value = 0;
            material_ref.uniforms.u_HSL_Palette.value = window.g_hsl_palette;
        });
    }

    g_renderer.render( g_scene, g_camera );
}