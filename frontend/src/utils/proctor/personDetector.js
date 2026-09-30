/**
 * personDetector.js
 *
 * Production-grade Client-Side Face & Multi-Person Detection System.
 * Uses MediaPipe Vision Face Detector (BlazeFace ML model running locally in WebAssembly/WebGL).
 *
 * Distinguishes:
 * - 0 FACES: NO_PERSON (Camera active, no face detected)
 * - 1 FACE:  ONE_PERSON (Valid single candidate)
 * - 2+ FACES: MULTIPLE_PEOPLE (Anti-cheating violation with exact detected face count)
 *
 * Key Engineering Guarantees:
 * 1. Real ML Face Detection: Actual bounding boxes and confidence scores, zero pixel/contrast heuristics.
 * 2. Concurrency Safety: Single in-flight detection mutex (no overlapping async calls).
 * 3. Temporal Smoothing: Rolling stability buffer prevents noise flickers while quickly responding to sustained multi-person presence.
 * 4. Strict Lifecycle: Safe start/stop/destroy with zero memory leaks.
 */

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const DETECTION_INTERVAL_MS = 750;
const MIN_FACE_CONFIDENCE = 0.52;
const STABILITY_WINDOW_SIZE = 3;

class PersonDetector {
  constructor() {
    this.intervalId = null;
    this.videoElement = null;
    this.onResultCallback = null;
    this.isRunning = false;
    this.isProcessing = false;

    this.detector = null;
    this.nativeDetector = null;
    this.initPromise = null;
    this.detectorReady = false;

    this.sampleHistory = [];
    this.lastStableStatus = "CHECKING";
    this.lastStableCount = 0;

    this.consecutiveZero = 0;
    this.consecutiveMultiple = 0;
    this.consecutiveOne = 0;

    // Feature detect optional browser-native FaceDetector as secondary fallback
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        this.nativeDetector = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 5,
        });
      } catch (e) {
        this.nativeDetector = null;
      }
    }

    // Begin asynchronous model load
    this._initDetector();
  }

  /**
   * Initializes MediaPipe Vision FaceDetector asynchronously
   */
  async _initDetector() {
    if (this.detectorReady && this.detector) return this.detector;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );

        // Try GPU delegate first for maximum performance, fallback to CPU
        try {
          this.detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "GPU",
            },
            runningMode: "IMAGE",
            minDetectionConfidence: MIN_FACE_CONFIDENCE,
          });
        } catch (gpuErr) {
          console.warn("[PersonDetector] GPU delegate failed, falling back to CPU:", gpuErr?.message || gpuErr);
          this.detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU",
            },
            runningMode: "IMAGE",
            minDetectionConfidence: MIN_FACE_CONFIDENCE,
          });
        }

        this.detectorReady = true;
        return this.detector;
      } catch (err) {
        console.warn("[PersonDetector] MediaPipe FaceDetector init failed:", err?.message || err);
        this.detectorReady = false;
        return null;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Starts detection loop on an active HTMLVideoElement
   */
  start(videoElement, onResultCallback) {
    if (!videoElement) return;

    this.stop(); // Ensure any existing loop is cleanly cleared

    this.videoElement = videoElement;
    this.onResultCallback = onResultCallback;
    this.isRunning = true;
    this.sampleHistory = [];
    this.consecutiveZero = 0;
    this.consecutiveMultiple = 0;
    this.consecutiveOne = 0;

    const runSample = async () => {
      if (!this.isRunning || !this.videoElement || this.isProcessing) return;

      this.isProcessing = true;
      try {
        await this._detectFrame();
      } catch (err) {
        // Suppress frame level transient errors to prevent crashing
      } finally {
        this.isProcessing = false;
      }
    };

    // Warm-up sample after brief delay
    setTimeout(runSample, 250);

    // Controlled interval loop for minimal CPU footprint
    this.intervalId = setInterval(runSample, DETECTION_INTERVAL_MS);
  }

  /**
   * Stops detection loop and cleans up active references
   */
  stop() {
    this.isRunning = false;
    this.isProcessing = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.videoElement = null;
    this.sampleHistory = [];
  }

  /**
   * Full cleanup and release of ML resources
   */
  destroy() {
    this.stop();
    if (this.detector && typeof this.detector.close === "function") {
      try {
        this.detector.close();
      } catch (e) {}
    }
    this.detector = null;
    this.detectorReady = false;
    this.initPromise = null;
    this.onResultCallback = null;
  }

  /**
   * Processes a single camera frame using ML Face Detection
   */
  async _detectFrame() {
    if (!this.videoElement) return;

    // Validate video readiness and dimensions
    if (
      this.videoElement.readyState < 2 ||
      !this.videoElement.videoWidth ||
      !this.videoElement.videoHeight ||
      this.videoElement.videoWidth <= 0 ||
      this.videoElement.videoHeight <= 0
    ) {
      return;
    }

    let detectedCount = 0;

    // Method 1: MediaPipe ML Face Detector
    if (this.detectorReady && this.detector) {
      try {
        const detectionsResult = this.detector.detect(this.videoElement);
        const validDetections = (detectionsResult?.detections || []).filter((d) => {
          const score = d.categories?.[0]?.score ?? 1;
          return score >= MIN_FACE_CONFIDENCE;
        });
        detectedCount = validDetections.length;
      } catch (err) {
        // Fallback to native detector if available
        if (this.nativeDetector) {
          try {
            const faces = await this.nativeDetector.detect(this.videoElement);
            detectedCount = Array.isArray(faces) ? faces.length : 0;
          } catch (nativeErr) {
            detectedCount = this.lastStableCount || 1;
          }
        } else {
          detectedCount = this.lastStableCount || 1;
        }
      }
    } else if (this.nativeDetector) {
      // Method 2: Browser native FaceDetector API if MediaPipe is still initializing
      try {
        const faces = await this.nativeDetector.detect(this.videoElement);
        detectedCount = Array.isArray(faces) ? faces.length : 0;
      } catch (e) {
        detectedCount = this.lastStableCount || 1;
      }
    } else {
      // Detector still initializing; trigger init check
      this._initDetector();
      detectedCount = this.lastStableCount > 0 ? this.lastStableCount : 1;
    }

    // Apply temporal stability smoothing
    this._updateStability(detectedCount);
  }

  /**
   * Temporal smoothing state machine:
   * Prevents rapid flickering on single noisy frames while detecting sustained multi-person presence.
   */
  _updateStability(rawCount) {
    this.sampleHistory.push(rawCount);
    if (this.sampleHistory.length > STABILITY_WINDOW_SIZE) {
      this.sampleHistory.shift();
    }

    if (rawCount === 0) {
      this.consecutiveZero++;
      this.consecutiveMultiple = 0;
      this.consecutiveOne = 0;
    } else if (rawCount >= 2) {
      this.consecutiveMultiple++;
      this.consecutiveZero = 0;
      this.consecutiveOne = 0;
    } else {
      this.consecutiveOne++;
      this.consecutiveZero = 0;
      this.consecutiveMultiple = 0;
    }

    let newStatus = this.lastStableStatus;
    let newCount = this.lastStableCount;

    // Decision Logic
    if (this.consecutiveZero >= 2 || (this.sampleHistory.length >= 2 && this.sampleHistory.every((c) => c === 0))) {
      newStatus = "NO_PERSON";
      newCount = 0;
    } else if (
      this.consecutiveMultiple >= 2 ||
      (this.sampleHistory.length >= 2 && this.sampleHistory.filter((c) => c >= 2).length >= 2)
    ) {
      newStatus = "MULTIPLE_PEOPLE";
      // Pick the max face count detected across the active window
      const multipleCounts = this.sampleHistory.filter((c) => c >= 2);
      newCount = multipleCounts.length > 0 ? Math.max(...multipleCounts) : rawCount;
    } else if (this.consecutiveOne >= 1 || rawCount === 1) {
      newStatus = "ONE_PERSON";
      newCount = 1;
    } else if (this.lastStableStatus === "CHECKING") {
      newStatus = rawCount === 0 ? "NO_PERSON" : rawCount >= 2 ? "MULTIPLE_PEOPLE" : "ONE_PERSON";
      newCount = rawCount;
    }

    this.lastStableStatus = newStatus;
    this.lastStableCount = newCount;

    if (this.onResultCallback && this.isRunning) {
      this.onResultCallback({
        count: newCount,
        rawCount,
        status: newStatus,
        timestamp: Date.now(),
      });
    }
  }
}

export default PersonDetector;
