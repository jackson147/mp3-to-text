const fs = require('fs')
const sdk = require("microsoft-cognitiveservices-speech-sdk")

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))

const subscriptionKey = config.subscriptionKey
const serviceRegion = config.serviceRegion

const inputDir = "audio/"
const language = "en-US"

function createAudioConfig(filename) {
    const format = sdk.AudioStreamFormat.getWaveFormatPCM(44100, 16, 2) //44.1 kHz, 16-bit, 2-channel
    const pushStream = sdk.AudioInputStream.createPushStream(format)

    fs.createReadStream(filename).on('data', arrayBuffer => {
        pushStream.write(arrayBuffer.slice())
    }).on('end', () => {
        pushStream.close()
    })

    return sdk.AudioConfig.fromStreamInput(pushStream)
}

function createRecognizer(audiofilename, audioLanguage) {
    const audioConfig = createAudioConfig(audiofilename)
    const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion)
    speechConfig.speechRecognitionLanguage = audioLanguage

    return new sdk.SpeechRecognizer(speechConfig, audioConfig)
}


let fileName = undefined
fs.readdir(inputDir, (err, files) => {

    if(fileName == undefined){
        fileName = files.shift()
    }

    let filePath = inputDir + fileName
    let recognizer = createRecognizer(filePath, language)

    recognizer.speechEndDetected = (s, e) => {
        console.log(`(speechEndDetected) SessionId: ${e.sessionId}`)
        recognizer.close()
        recognizer = undefined
        if(files.length != 0){
            fileName = files.shift()
            filePath = inputDir + fileName
            recognizer = createRecognizer(filePath, language)
            startRecognizer(recognizer, fileName)
        }
    }

    startRecognizer(recognizer, fileName)
});

function startRecognizer(recognizer, filename){
    outputText = ""

    recognizer.startContinuousRecognitionAsync(() => {
        console.log('Recognition started')
    },
    err => {
        console.trace("err - " + err)
        recognizer.close()
        recognizer = undefined
    })

    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.NoMatch) {
            const noMatchDetail = sdk.NoMatchDetails.fromResult(e.result)
            console.log("(recognized)  Reason: " + sdk.ResultReason[e.result.reason] + " | NoMatchReason: " + sdk.NoMatchReason[noMatchDetail.reason])
        } else {
            console.log(`(recognized)  Reason: ${sdk.ResultReason[e.result.reason]} | Duration: ${e.result.duration} | Offset: ${e.result.offset}`)
            console.log(`Text: ${e.result.text}`)
            fs.appendFileSync('output/' + filename + "_transcribed.txt", e.result.text);
        }
    }

    recognizer.canceled = (s, e) => {
        let str = "(cancel) Reason: " + sdk.CancellationReason[e.reason]
        if (e.reason === sdk.CancellationReason.Error) {
            str += ": " + e.errorDetails
        }
        console.log(str)
    }
}

