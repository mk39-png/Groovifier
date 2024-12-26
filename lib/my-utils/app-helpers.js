//---------------------------------
// HELPER FUNCTIONS (HTML/WEBSITE-RELATED)
//---------------------------------

// Used to setup the HTML interactive elements
/**
 * setup_input_listeners() establishes the sliders and user interaction with scaling, rotating, transforming the scene.
 * Though, it DOES NOT have any audio processing listeners, which are located in a different file.
 */
export function setup_input_listeners() {
    var rot_speed_slider_input = document.getElementById("rotSpeed");
    rot_speed_slider_input.addEventListener('input', (event) => {
        console.log("Speed")
        updateSceneSpeed(event.target.value);
    });

    var rot_x_slider_input = document.getElementById("rotateX");
    rot_x_slider_input.addEventListener('input', (event) => {
        updateWhaleRotation("xSliderLabel", event.target.value);
    });

    var rot_y_slider_input = document.getElementById("rotateY");
    rot_y_slider_input.addEventListener('input', (event) => {
        updateWhaleRotation("ySliderLabel", event.target.value);
    });

    var rot_z_slider_input = document.getElementById("rotateZ");
    rot_z_slider_input.addEventListener('input', (event) => {
        updateWhaleRotation("zSliderLabel", event.target.value);
    });

    var whale_slider_input = document.getElementById("scaleWhale");
    whale_slider_input.addEventListener('input', (event) => {
        updateWhaleScale("whaleSliderLabel", event.target.value);
    });

    var fin_slider_input = document.getElementById("scaleFin");
    fin_slider_input.addEventListener('input', (event) => {
        updateWhaleScale("finSliderLabel", event.target.value);
    });
}

/**
 * Updates the rotation speed
 * @param {*} amount This is some float value that specifies the angle of rotation in degrees that the models rotate/move at.
 */
function updateSceneSpeed(amount) {
    let label = document.getElementById('rotSliderLabel');
    label.textContent = `Scene Rot Speed (rad): ${amount}`;
    window.g_rotation_speed = amount;
}

/**
 * Updates the scale of either the fin or the whale
 * @param {*} id This is the ID of the HTML element that corresponds to a specific model/mesh of an assembly (i.e. "fin" or "whale") 
 * @param {*} amount This is a float that specifies that amount of scaling that is done on a model/mesh of an assembly (i.e. "fin" or "whale")
 */
function updateWhaleScale(id, amount) {
    console.log(id)
    console.log(amount);
    var label = document.getElementById(id);
    label.textContent = `${id} Scale: ${amount}`;

    if (id.includes('fin')) {
        window.g_fin_scale = Number(amount);
    }

    if (id.includes('whale')) {
        window.g_whale_scale = Number(amount);
    }
}

/**
 * Event to change which rotation is selected. Does so from 0 to 1.
 * @param {*} id This is the ID of the HTML element that corresponds to an axis of rotation for the whale model (i.e. x, y, or z)
 * @param {*} amount This is the angle (in degrees) that the specified ID axis rotates at.
 */
// Does so from 0 to 1
function updateWhaleRotation(id, amount) {
    console.log(id)
    console.log(amount);
    var label = document.getElementById(id);

    // Now, update g_rotation_axis depending on the axis updated
    if (id.includes('x')) {
        label.textContent = `x - Whale Rotation Axis: ${amount}`;
        window.g_rotation_axis[0] = Number(amount);
    }

    if (id.includes('y')) {
        label.textContent = `y - Whale Rotation Axis: ${amount}`;
        window.g_rotation_axis[1] = Number(amount);
    }

    if (id.includes('z')) {
        label.textContent = `z - Whale Rotation Axis: ${amount}`;
        window.g_rotation_axis[2] = Number(amount);
    }

    console.log(window.g_rotation_axis)
}

//------------------------
// Audio helper function
//------------------------
// Referenced the source below for this implementation of .reduce()
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
/**
 * This is used as a helper for the .reduce() function of an array.
 * @param {*} accumulator The sum of all previous numbers (aka the numbers accumulated so far).
 * @param {*} currentValue The number to add upon the previous numbers.
 * @returns accumulator + currentValue
 */
export function sum(accumulator, currentValue) {
    return accumulator + currentValue;
}