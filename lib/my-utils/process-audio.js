//----- SOURCES I REFERENCED FOR ESSENTIA.JS PROCESSING -----\\
// GitHub page for Essentia.js
// https://mtg.github.io/essentia.js/
// Referenced the below source to see the simple web example
// https://mtg.github.io/essentia.js/docs/api/tutorial-1.%20Getting%20started.html
// I also referenced the starter code featured on the research paper for Essentia.js 
// https://repositori.upf.edu/bitstream/handle/10230/45451/bogdanov_ismir_essent.pdf?sequence=1
// Finally, I referenced the "Introduction to MIR using Essentia.js" PDF
// https://github.com/MTG/essentia.js-tutorial-wac2021/blob/main/Introduction%20to%20MIR%20using%20Essentia.js.pdf

// BIG NOTE: the whole audio functionality works better with lossless audio since it preserves the high frequencies of the audio file.
//  Though, this makes the whole processing take longer depending on the length of the audio file.

import { EssentiaWASM } from '../essentia-wasm.es.js';
import Essentia from '../essentia.js-core.es.js';
const essentia = new Essentia(EssentiaWASM);

/**
 * audio_process() runs a Web Worker to use essentia.js and extract features from user-inputted audio. It also runs on the 
 * main thread to do some vanilla JS audio processing. 
 * essentia.js functions are only executed when the user inputs an audio file. Otherwise, there would be no audio file to analyze.
 * @param {*} audio_processor does not take in any parameters. But it does require the essentia-worker.js file, audioFile HTML ID, and audioControl HTML ID.
 * @returns g_file (aka reference to the document audioFile element).
 */
export async function audio_processor() {
    // Below code from sample code provided by the essentia.js documentation:
    // https://mtg.github.io/essentia.js/docs/api/tutorial-2.%20Real-time%20analysis.html#using-the-web-audio-api-with-audioworklets

    // Referencing below:
    // https://www.w3schools.com/html/html5_webworkers.asp
    // NOTE: When creating audioWorker, there is no exception/catch for filename and whether it's invalid...
    //  so be super careful when typing the file name!
    const worker_url = new URL("essentia-worker.js", import.meta.url); // Makes a relative filename
    let audioWorker = new Worker(worker_url, { type: 'module' });

    //----- AUDIO SETUP (which we only need to do once, fyi) -----\\
    let g_file = document.getElementById("audioFile");
    let g_audioElement = document.getElementById("audioControl");
    let audioCtx = new AudioContext(); // Now, what is AudioContext? Well, it's basically the meats and potatoes for JavaScript's audio-processing graph

    let g_source = audioCtx.createMediaElementSource(g_audioElement); // Creates an object based on the HTML element <audio>
    let g_analyser = audioCtx.createAnalyser(); // This is the middleman of the audio pipeline that does the analysis of the incoming stream of audio
    g_source.connect(g_analyser); // Connecting the source to the analyzer as part of the audio pipeline
    g_analyser.connect(audioCtx.destination); // Finally, connecting the pipeline to the destination for the user to hear
    g_analyser.fftSize = 256; // represents the window size of samples while performing Fast Fourier Transform
    let g_bufferLength = g_analyser.frequencyBinCount; // frequencyBinCount is basically the sampleRate and is half the value of the .fftSize

    // Also, is this like an addEventListener. In that, whenever the user inputs an audio file, this function is executed.
    // From the various documentation on .js vanilla visualizers, this source was the clearest and helped direct my implementation the most:
    // https://codepen.io/nfj525/pen/rVBaab
    // QUESTION: My main confusion centered around how to get the audio file as a stream of data (and how the visualizer would change as the audio is playing). 
    //      Would the analysis just occur once before the audio even started? 
    // ANSWER: But, I learned that, yes, at least with this implementation, the analysis occurs AS the audio is playing. 
    //  So, we get a dynamic histogram of the frequencies of the given audio file.
    //  Meanwhile, libraries like Essentia.js usually does its calculations beforehand since it has more complex methods 
    //   (though, it does have the option for real-time analysis of audio).
    g_file.onchange = async function() {
        // NOTE: Keep AudioContext().resume() in here because Google Chrome is very strict on getting user input to active audio-related stuff.
        // Because if you don't have .resume() without any user input, then Google Chrome won't autoplay the song and the 
        //  whole audio analysis system will be messed up (for any new users)
        audioCtx.resume();

        let files = this.files; // grab the references to the user's files

        // This is here since the user can select multiple files. So, we just want the first audio file.
        // Also, we create a .js blob to reference to the user's inputted file
        // But, this is quite critical since this simplifies the whole filesystem thing that needs to be done.
        const url = URL.createObjectURL(files[0]); 

        // NOTE: WebWorkers CANNOT access the DOM.
        //----- Vanilla Audio Processing -----\\
        g_audioElement.src = url;
        g_audioElement.load(); // resets audio element to initial state and begins selecting and loading the audio source for playback

        let g_dataArray = new Uint8Array(g_bufferLength); // So, length of the array is the bufferLength, which is basically the number of samples of the audio at a given moment
        g_analyser.getByteFrequencyData(g_dataArray);

        // Fetching and decoding audio
        const audioBuffer = await essentia.getAudioBufferFromURL(url, new AudioContext());

        // Basically turning the audio file waveform into a series of amplitudes, at least that's my knowledge of it
        const audioArray = await essentia.audioBufferToMonoSignal(audioBuffer);

        // Sending the audio url to the essentia-worker.js Worker to do essentia.js analyses
        audioWorker.postMessage(audioArray);

        // Display in the website that the audio is processing
        const label = document.getElementById('audioProcessing');
        label.textContent = "Please wait around 30 seconds or so... Audio is currently processing...";

        // Then, send and receive messages from the audioWorker.
        audioWorker.onmessage = function(event) {
            console.log("We got from message the following:", event.data)

            // After done processing the audio, play it for the user to hear
            g_audioElement.play();

            // Display in the website that the audio is done processing
            const label = document.getElementById('audioProcessing');
            label.textContent = `Audio is done processing!`;

            //----- Essentia.js Audio Processing -----\\
            // So, we get data sent back to use from the essentia_worker.js function that's been ran 
            const [bpm, confidence, danceability, energy, dynamicComplexity, loudness] = event.data;

            // Assigning to audioAnalyses is basically like return by making these variables accessible in app.js
            g_file.audioAnalyses = {"bpm": bpm, "confidence": confidence, "danceability": danceability, 
                                    "energy": energy, "dynamicComplexity": dynamicComplexity, "loudness": loudness, 
                                    "g_analyser": g_analyser, 'dataArray': g_dataArray};
        }
    }

    return g_file;
}