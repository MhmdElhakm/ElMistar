/*
 * Local Quran tasmee ASR.
 *
 * The microphone stream is decoded and transcribed in this tab. No audio is
 * sent to a speech service. The first run downloads the open-source Whisper
 * ONNX files into the Transformers.js browser cache; later runs can be
 * completely offline. A local Quran-Lab Zipformer can be selected by setting
 * window.QURAN_TASMEE_MODEL before this file is loaded.
 */
(function (global) {
  'use strict';

  var DEFAULT_MODEL = 'Xenova/whisper-tiny';
  var MODEL = global.QURAN_TASMEE_MODEL || DEFAULT_MODEL;
  var SAMPLE_RATE = 16000;
  var transcriberPromise = null;
  var mediaRecorder = null;
  var stream = null;
  var running = false;
  var processing = Promise.resolve();
  var pendingChunks = [];
  var lastTranscript = '';

  function status(onStatus, text) {
    if (typeof onStatus === 'function') onStatus(text);
  }

  async function getTranscriber(onStatus) {
    if (transcriberPromise) return transcriberPromise;
    transcriberPromise = (async function () {
      status(onStatus, 'جارٍ تجهيز محرك التعرف المحلي…');
      var transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
      var pipeline = transformers.pipeline;
      return pipeline('automatic-speech-recognition', MODEL, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: function (event) {
          if (event && event.status === 'progress' && Number.isFinite(event.progress)) {
            status(onStatus, 'جارٍ تنزيل نموذج التلاوة محليًا ' + Math.round(event.progress) + '%…');
          }
        }
      });
    })().catch(function (error) {
      transcriberPromise = null;
      throw error;
    });
    return transcriberPromise;
  }

  async function decode(blob) {
    var context = new (global.AudioContext || global.webkitAudioContext)();
    try {
      var buffer = await context.decodeAudioData(await blob.arrayBuffer());
      var channel = buffer.getChannelData(0);
      if (buffer.sampleRate === SAMPLE_RATE) return new Float32Array(channel);
      var length = Math.ceil(channel.length * SAMPLE_RATE / buffer.sampleRate);
      var offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
      var source = offline.createBufferSource();
      var input = offline.createBuffer(1, channel.length, buffer.sampleRate);
      input.copyToChannel(channel, 0);
      source.buffer = input;
      source.connect(offline.destination);
      source.start();
      return (await offline.startRendering()).getChannelData(0);
    } finally {
      if (context.close) await context.close();
    }
  }

  async function transcribe(blob, options) {
    var onStatus = options.onStatus;
    var recognizer = await getTranscriber(onStatus);
    var audio = await decode(blob);
    if (!audio.length) return;
    status(onStatus, 'يستمع ويحلل التلاوة على الجهاز…');
    var result = await recognizer(audio, {
      language: 'arabic',
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 20,
      stride_length_s: 4
    });
    var text = result && result.text ? String(result.text).trim() : '';
    if (text && text !== lastTranscript) {
      lastTranscript = text;
      options.onTranscript(text);
    }
  }

  function enqueue(blob, options) {
    processing = processing.then(function () {
      if (!running) return;
      return transcribe(blob, options).catch(function (error) {
        status(options.onStatus, 'تعذر تحليل المقطع محليًا؛ تحقق من تنزيل النموذج والميكروفون.');
        if (global.console) console.warn('Local Quran ASR:', error);
      });
    });
  }

  async function start(options) {
    if (running) return;
    options = options || {};
    if (!global.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('يحتاج الميكروفون إلى HTTPS أو localhost.');
    }
    if (!global.MediaRecorder || !global.navigator.mediaDevices) {
      throw new Error('هذا المتصفح لا يدعم التسجيل المحلي.');
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false
    }});
    var mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(function (value) {
      return MediaRecorder.isTypeSupported(value);
    }) || '';
    running = true;
    pendingChunks = [];
    lastTranscript = '';
    function recordUtterance() {
      var recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorder = recorder;
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) {
          pendingChunks.push(event.data);
          // Stop/restart to give every WebM utterance its own container header.
          if (pendingChunks.length >= 4 && recorder.state === 'recording') recorder.stop();
        }
      };
      recorder.onstop = function () {
        var chunks = pendingChunks;
        pendingChunks = [];
        if (chunks.length) enqueue(new Blob(chunks, { type: recorder.mimeType }), options);
        if (running) recordUtterance();
      };
      recorder.start(4000);
    }
    recordUtterance();
    status(options.onStatus, 'الميكروفون يعمل؛ تُحلل التلاوة محليًا دون رفع الصوت.');
  }

  function stop() {
    running = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    mediaRecorder = null;
    stream = null;
    pendingChunks = [];
  }

  global.QuranTasmeeEngine = {
    model: MODEL,
    start: start,
    stop: stop,
    isRunning: function () { return running; }
  };
})(window);
