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

  // Base is noticeably more reliable for Arabic than tiny while remaining
  // practical in the browser. It can still be overridden before this file is
  // loaded with window.QURAN_TASMEE_MODEL.
  var DEFAULT_MODEL = 'Xenova/whisper-base';
  var MODEL = global.QURAN_TASMEE_MODEL || DEFAULT_MODEL;
  var SAMPLE_RATE = 16000;
  var UTTERANCE_MS = 2500;
  var transcriberPromise = null;
  var mediaRecorder = null;
  var stream = null;
  var running = false;
  var startPromise = null;
  var lifecycleToken = 0;
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
      temperature: 0,
      condition_on_prev_tokens: false,
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
    if (startPromise) return startPromise;
    options = options || {};
    var token = ++lifecycleToken;
    startPromise = (async function () {
      if (!global.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('يحتاج الميكروفون إلى HTTPS أو localhost.');
      }
      if (!global.MediaRecorder || !global.navigator.mediaDevices) {
        throw new Error('هذا المتصفح لا يدعم التسجيل المحلي.');
      }
      var acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false
      }});
      // If stop() was called while the permission prompt was open, do not
      // leave an orphaned microphone stream behind.
      if (token !== lifecycleToken) {
        acquiredStream.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      stream = acquiredStream;
      var mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(function (value) {
        return MediaRecorder.isTypeSupported(value);
      }) || '';
      running = true;
      pendingChunks = [];
      lastTranscript = '';
      function recordUtterance() {
        if (!running || !stream || stream.getTracks().every(function (track) { return track.readyState === 'ended'; })) return;
        var recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mediaRecorder = recorder;
        recorder.ondataavailable = function (event) {
          if (event.data && event.data.size) {
            pendingChunks.push(event.data);
            // Rotate short analysis windows while keeping the same microphone
            // stream alive. This lets words appear during recitation instead
            // of waiting for the speaker to stop.
            if (pendingChunks.length >= 1 && recorder.state === 'recording') recorder.stop();
          }
        };
        recorder.onstop = function () {
          var chunks = pendingChunks;
          pendingChunks = [];
          if (chunks.length) enqueue(new Blob(chunks, { type: recorder.mimeType }), options);
          if (running && mediaRecorder === recorder) recordUtterance();
        };
        recorder.onerror = function (event) {
          if (global.console) console.warn('Local Quran recorder:', event.error || event);
        };
        recorder.start(UTTERANCE_MS);
      }
      recordUtterance();
      status(options.onStatus, 'الميكروفون يعمل؛ تُحلل التلاوة محليًا دون رفع الصوت.');
    })();
    try {
      await startPromise;
    } finally {
      startPromise = null;
    }
  }

  function stop() {
    lifecycleToken++;
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
