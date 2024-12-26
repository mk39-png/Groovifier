// This function will need to convert RGB to HSL for usage in the dither shader.
function RGBtoHSL(red, green, blue) {
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

	let color_max_M = Math.max(red, green, blue);	
	let color_min_m = Math.min(red, green, blue);

	let chroma = color_max_M - color_min_m;

	// Comparing floats according to precision.
	// This is here because I'm uneasy about using '===' for floating point comparisons.
	const equal_floats = (num1, num2) => Math.abs(num1 - num2) <= 1e-15 ? true : false;

	let hue_prime = 0.0;
	let saturation = 0.0;
	let luminence = 0.0;

	//----- HUE -----//
	if (equal_floats(chroma, 0.0)) {
		hue_prime = 0.0;
	} else if (equal_floats(color_max_M, red)) {
		hue_prime = ((green - blue) / chroma) % 6.0;
	} else if (equal_floats(color_max_M, green)) {
		hue_prime = ((blue - red) / chroma) + 2.0;
	} else if (equal_floats(color_max_M, blue)) {
		hue_prime = ((red - green) / chroma) + 4.0;
	}

	let hue = 60.0 * hue_prime;

	// NOTE: Hue may be negative, so add 360 to make it positive again! 
	// Can add 360 because HSL's Hue value is circular.
	if (hue < 0.0) {
		hue += 360.0;
	}

	// Finally, we want to round up to the nearest whole number since Hue color space is integers 0 to 360
	hue = Math.round(hue);

	//----- LUMINENCE/LIGHTNESS -----//
	luminence = (color_max_M + color_min_m) / 2.0;

	//----- SATURATION -----//
	if (equal_floats(luminence, 1.0) || equal_floats(luminence, 0.0)) {
		saturation = 0.0;
	} else {
		saturation = chroma / (1.0 - Math.abs((2.0 * luminence) - 1.0));
	}

	return [hue, saturation, luminence];
}


// HSLtoRGB used to test color conversion process.
function HSLtoRGB(hue, saturation, luminence) {
	// Referencing the formula in the website below (at least to understand what the variables stand for)
	// https://dystopiancode.blogspot.com/2012/06/hsl-rgb-conversion-algorithms-in-c.html

	// The source below actually demonstrates the whole converted from HSL to RGB a lot better.
	// Though, it doesn't name the variables, which is a shame.
	// 	https://www.js-craft.io/blog/an-introduction-to-hsl-colors-in-css/
	let chroma = (1.0 - Math.abs((2.0 * luminence) - 1.0)) * saturation;

	// x is intermediate value for calculating r, g, b
	// To be honest, I'm not too sure what it is exactly, I'm just following the formula.
	let x = chroma * (1.0 - Math.abs(((hue / 60.0) % 2.0) - 1.0));

	// m is intermediate value for calculating r, g, b baseline
	let m = luminence - (chroma / 2.0);

	let rgb;

	// I know that this if-else block of code is disgusting to look at...
	// 	but it's the simplest.
	if ((0.0 <= hue) && (hue < 60.0)) {
		rgb = [chroma, x, 0];
	}
	else if ((60.0 <= hue) && (hue < 120.0))  {
		rgb = [x, chroma, 0];
	}
	else if ((120.0 <= hue) && (hue < 180.0)) {
		rgb = [0, chroma, x];
	}
	else if ((180.0 <= hue) && (hue < 240.0)) {
		rgb = [0, x, chroma];
	}
	else if ((240.0 <= hue) && (hue < 300.0)) {
		rgb = [x, 0, chroma];
	}
	else if ((300.0 <= hue) && (hue < 360.0)) { // TODO: what if 360?
		rgb = [chroma, 0, x];
	} else {
		// This would mean that hue is 360, which is equivalent to 0.
		// So, just use the 1st condition.
		rgb = [chroma, x, 0];
	}

	// Then, add m to RGB values.
	rgb[0] += m;
	rgb[1] += m;
	rgb[2] += m;

	// rgb[0] *= 255;
	// rgb[1] *= 255;
	// rgb[2] *= 255;

	return rgb;
}


/**
 * process_image_palette(url) takes in a 16x1 pixel image file, parses its colors, converts its colors to HSL color space, and returns the color of the image as a 16 * 3 array.
 * This HSL array is then used as the color palette for Ordered Dithering with a 4x4 matrix.
 * NOTE: It's 16 * 3 array because the 3 represents the Hue (0 to 360), Saturation (0.0 to 1.0), and Lightness (0.0 to 1.0) value of the colors.
 * process_image_palette(url) also removes the alpha from RGBA to only process RGB values.
 * @param {*} url This represents the URL of the user-selected image file.
 * @return This function does not return any value. But, it does set window.g_hsl_palette to the color palette image specified by the URL.
 */
export async function process_image_palette(url) {
	let img = new Image();
	img.src = url;

	// The below code is used quite a bit to extract the color palette.
	// https://coderwall.com/p/jzdmdq/loading-image-from-local-file-into-javascript-and-getting-pixel-data
	var canvas = document.createElement("canvas");
	var ctx = canvas.getContext("2d");

	// TODO: add a listener to see when a file gets uploaded and whatnot.
	let img_file = document.getElementById("paletteFile");


	// This simply just changes the URL to refer to our new palette image
	// Then, img event listener will handle the computation of the HSL color palette
	img_file.onchange = async function() {
        let files = this.files; // grab the references to the user's files
        const url = URL.createObjectURL(files[0]); 

		img.src = url;
	}

	
	// This is for when image is initially loadded, like, when called or whatnot..
	img.addEventListener('load', () => {
		ctx.drawImage(img, 0, 0);
		
		// NOTE: image data will be 0 to 255 (even the alpha value will be between 0 and 255)
		// https://developer.mozilla.org/en-US/docs/Web/API/ImageData/data
		let image_rgba = ctx.getImageData(0, 0, img.width, img.height).data;

		console.log("color palette image data:", image_rgba);

		// This gets a 2D array where each element is an array RGBA
		let hsl_colors = []

		if (img.width > 16 || img.height > 1) {
			throw Error("Image is not a 16x1 pixel size");
		}

		for (let i = 0; i < image_rgba.length; i += 4) {
			let rgb = image_rgba.slice(i, i + 3); // Only gets RGB values, leaving out A

			// Normalize RGB values.
			let hsl = RGBtoHSL(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);

			hsl_colors.push(hsl);
		}

		// For global access
		window.g_hsl_palette = hsl_colors.flat();

		// TODO: implement some sort of removeEventListener after loading the image so that we don't have to deal with 
		//	event listeners taking up too many resources.
	}, false);
}