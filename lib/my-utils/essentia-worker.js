// essentia_worker.js
// This takes in the URL to an audio file and outputs the BPM and Danceability of the audio file.
// This is to allow for background processing of music analysis functions, which arguably takes up the most processing power and 
//  can slow down the program quite a bit!
// Actually need to decode ALL OF THE AUDIO into an audio array.

import { EssentiaWASM } from '../essentia-wasm.es.js';
import Essentia from '../essentia.js-core.es.js';

const essentia = new Essentia(EssentiaWASM);

// Initially referencing the source below, but realized that Web Workers is more applicable than AudioWorklets in my case.
// https://mtg.github.io/essentia.js/docs/api/tutorial-2.%20Real-time%20analysis.html#using-the-web-audio-api-with-audioworklets

// For passing data into worker:
// https://stackoverflow.com/questions/4019230/javascript-web-workers-how-do-i-pass-arguments

// For seeing a basic Web Worker implementation:
// https://github.com/mdn/dom-examples/blob/main/web-workers/simple-web-worker/worker.js

// https://web.dev/articles/off-main-thread
onmessage = async function(event) {
    console.log("We got from main thread the following:", event.data);
    const audioArray = event.data;

    //------ essentia.js processing ------\\
    // Converting audioArray to a usable format by essentia.js
    const audioVector = await essentia.arrayToVector(audioArray);

    // Now, using the various methods of essentia.js to get some features from the inputted audio
    const rhythmExtractorPromise = essentia.RhythmExtractor2013(audioVector);
    const danceabiltyPromise = essentia.Danceability(audioVector);
    const energyPromise = essentia.Energy(audioVector);
    const loudnessPromise = essentia.DynamicComplexity(audioVector);

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    Promise.all([rhythmExtractorPromise, danceabiltyPromise, energyPromise, loudnessPromise])
        .then(([rhythmExtractorOutput, danceabilityOutput, energyOutput, loudnessOutput]) => {
            console.log("These are values from waiting", rhythmExtractorOutput, danceabilityOutput, energyOutput, loudnessOutput);
            const bpm = rhythmExtractorOutput.bpm;
            const confidence = rhythmExtractorOutput.confidence;
            const danceability = danceabilityOutput.danceability;
            const energy = energyOutput.energy;
            const dynamicComplexity = loudnessOutput.dynamicComplexity;
            const loudness = loudnessOutput.loudness;

            postMessage([bpm, confidence, danceability, energy, dynamicComplexity, loudness]);
    });
}

onerror = function (event) {
    console.log(event);
    alert(event.message);
}