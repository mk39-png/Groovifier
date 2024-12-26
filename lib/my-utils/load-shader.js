/**
 * load_shader(url) simply fetches the GLSL shader file and returns it as a string.
 * @param {*} url specifies the URL of the GLSL file
 * @returns the GLSL file as a string
 */
export async function load_shader(url) {
    var result = await fetch(url) // fetch() returns a Promise, which is fulfilled with a Response object (according to the documentation)
    .then((response) => { // with the Response object, take body as text and returns another Promise
        return response.text();
    })
    .then(raw_strings => { // Finally, we resolve with string.
        return raw_strings; // return our GLSL file out of .then()
    }) // END OF .then()
    .catch(error => {
        console.error(`Something went wrong while trying to get the shader: ${error}`)
    });

    return result; // return the shader as a string.
}