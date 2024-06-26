// Helpers for Web Audio tests

// It is expected that the test defines this.
/* global gTest */

function expectException(func, exceptionCode) {
  var threw = false;
  try {
    func();
  } catch (ex) {
    threw = true;
    is(ex.constructor.name, "DOMException", "Expect a DOM exception");
    is(ex.code, exceptionCode, "Expect the correct exception code");
  }
  ok(threw, "The exception was thrown");
}

function expectNoException(func) {
  var threw = false;
  try {
    func();
  } catch (ex) {
    threw = true;
  }
  ok(!threw, "An exception was not thrown");
}

function expectTypeError(func) {
  var threw = false;
  try {
    func();
  } catch (ex) {
    threw = true;
    ok(ex instanceof TypeError, "Expect a TypeError");
  }
  ok(threw, "The exception was thrown");
}

function expectRejectedPromise(that, func, exceptionName) {
  var promise = that[func]();

  ok(promise instanceof Promise, "Expect a Promise");

  promise
    .then(function () {
      ok(false, "Promise resolved when it should have been rejected.");
    })
    .catch(function (err) {
      is(
        err.name,
        exceptionName,
        "Promise correctly reject with " + exceptionName
      );
    });
}

function fuzzyCompare(a, b) {
  return Math.abs(a - b) < 9e-3;
}

function compareChannels(
  buf1,
  buf2,
  /*optional*/ length,
  /*optional*/ sourceOffset,
  /*optional*/ destOffset,
  /*optional*/ skipLengthCheck
) {
  if (!skipLengthCheck) {
    is(buf1.length, buf2.length, "Channels must have the same length");
  }
  sourceOffset = sourceOffset || 0;
  destOffset = destOffset || 0;
  if (length == undefined) {
    length = buf1.length - sourceOffset;
  }
  var difference = 0;
  var maxDifference = 0;
  var firstBadIndex = -1;
  for (var i = 0; i < length; ++i) {
    if (!fuzzyCompare(buf1[i + sourceOffset], buf2[i + destOffset])) {
      difference++;
      maxDifference = Math.max(
        maxDifference,
        Math.abs(buf1[i + sourceOffset] - buf2[i + destOffset])
      );
      if (firstBadIndex == -1) {
        firstBadIndex = i;
      }
    }
  }

  is(
    difference,
    0,
    "maxDifference: " +
      maxDifference +
      ", first bad index: " +
      firstBadIndex +
      " with test-data offset " +
      sourceOffset +
      " and expected-data offset " +
      destOffset +
      "; corresponding values " +
      buf1[firstBadIndex + sourceOffset] +
      " and " +
      buf2[firstBadIndex + destOffset] +
      " --- differences"
  );
}

function compareBuffers(got, expected) {
  if (got.numberOfChannels != expected.numberOfChannels) {
    is(
      got.numberOfChannels,
      expected.numberOfChannels,
      "Correct number of buffer channels"
    );
    return;
  }
  if (got.length != expected.length) {
    is(got.length, expected.length, "Correct buffer length");
    return;
  }
  if (got.sampleRate != expected.sampleRate) {
    is(got.sampleRate, expected.sampleRate, "Correct sample rate");
    return;
  }

  for (var i = 0; i < got.numberOfChannels; ++i) {
    compareChannels(
      got.getChannelData(i),
      expected.getChannelData(i),
      got.length,
      0,
      0,
      true
    );
  }
}

/**
 * Compute the root mean square (RMS,
 * <http://en.wikipedia.org/wiki/Root_mean_square>) of a channel of a slice
 * (defined by `start` and `end`) of an AudioBuffer.
 *
 * This is useful to detect that a buffer is noisy or silent.
 */
function rms(audiobuffer, channel = 0, start = 0, end = audiobuffer.length) {
  var buffer = audiobuffer.getChannelData(channel);
  var rms = 0;
  for (var i = start; i < end; i++) {
    rms += buffer[i] * buffer[i];
  }

  rms /= buffer.length;
  rms = Math.sqrt(rms);
  return rms;
}

function getEmptyBuffer(context, length) {
  return context.createBuffer(
    gTest.numberOfChannels,
    length,
    context.sampleRate
  );
}

function isChannelSilent(channel) {
  for (var i = 0; i < channel.length; ++i) {
    if (channel[i] != 0.0) {
      return false;
    }
  }
  return true;
}

const HRTFPannersByRate = new Map();
/**
 * Return a promise that resolves when PannerNodes with HRTF panningModel in
 * an AudioContext of the specified sample rate will be ready to produce
 * non-zero output.  Before the HRIR database is loaded, such PannerNodes
 * produce zero output.
 */
async function promiseHRTFReady(sampleRate) {
  if (HRTFPannersByRate.has(sampleRate)) {
    return;
  }

  const ctx = new AudioContext({ sampleRate });
  const processor = ctx.createScriptProcessor(4096, 2, 0);
  const panner = new PannerNode(ctx, { panningModel: "HRTF" });
  panner.connect(processor);
  const oscillator = ctx.createOscillator();
  oscillator.connect(panner);
  oscillator.start(0);

  await new Promise(r => {
    processor.onaudioprocess = e => {
      if (!isChannelSilent(e.inputBuffer.getChannelData(0))) {
        r();
      }
    };
  });

  ctx.suspend();
  oscillator.disconnect();
  panner.disconnect();
  processor.onaudioprocess = null;
  // Keep a reference to the panner so that the database is not unloaded.
  HRTFPannersByRate.set(sampleRate, panner);
}

/**
 * This function assumes that the test file defines a single gTest variable with
 * the following properties and methods:
 *
 * + numberOfChannels: optional property which specifies the number of channels
 *                     in the output.  The default value is 2.
 * + createGraph: mandatory method which takes a context object and does
 *                everything needed in order to set up the Web Audio graph.
 *                This function returns the node to be inspected.
 * + createGraphAsync: async version of createGraph.  This function takes
 *                     a callback which should be called with an argument
 *                     set to the node to be inspected when the callee is
 *                     ready to proceed with the test.  Either this function
 *                     or createGraph must be provided.
 * + createExpectedBuffers: optional method which takes a context object and
 *                          returns either one expected buffer or an array of
 *                          them, designating what is expected to be observed
 *                          in the output.  If omitted, the output is expected
 *                          to be silence.  All buffers must have the same
 *                          length, which must be a bufferSize supported by
 *                          ScriptProcessorNode.  This function is guaranteed
 *                          to be called before createGraph.
 * + length: property equal to the total number of frames which we are waiting
 *           to see in the output, mandatory if createExpectedBuffers is not
 *           provided, in which case it must be a bufferSize supported by
 *           ScriptProcessorNode (256, 512, 1024, 2048, 4096, 8192, or 16384).
 *           If createExpectedBuffers is provided then this must be equal to
 *           the number of expected buffers * the expected buffer length.
 *
 * + skipOfflineContextTests: optional. when true, skips running tests on an offline
 *                            context by circumventing testOnOfflineContext.
 */
function runTest() {
  function done() {
    SimpleTest.finish();
  }

  SimpleTest.waitForExplicitFinish();
  function runTestFunction() {
    if (!gTest.numberOfChannels) {
      gTest.numberOfChannels = 2; // default
    }

    var testLength;

    function runTestOnContext(context, callback, testOutput) {
      if (!gTest.createExpectedBuffers) {
        // Assume that the output is silence
        var expectedBuffers = getEmptyBuffer(context, gTest.length);
      } else {
        var expectedBuffers = gTest.createExpectedBuffers(context);
      }
      if (!(expectedBuffers instanceof Array)) {
        expectedBuffers = [expectedBuffers];
      }
      var expectedFrames = 0;
      for (var i = 0; i < expectedBuffers.length; ++i) {
        is(
          expectedBuffers[i].numberOfChannels,
          gTest.numberOfChannels,
          "Correct number of channels for expected buffer " + i
        );
        expectedFrames += expectedBuffers[i].length;
      }
      if (gTest.length && gTest.createExpectedBuffers) {
        is(expectedFrames, gTest.length, "Correct number of expected frames");
      }

      if (gTest.createGraphAsync) {
        gTest.createGraphAsync(context, function (nodeToInspect) {
          testOutput(nodeToInspect, expectedBuffers, callback);
        });
      } else {
        testOutput(gTest.createGraph(context), expectedBuffers, callback);
      }
    }

    function testOnNormalContext(callback) {
      function testOutput(nodeToInspect, expectedBuffers, callback) {
        testLength = 0;
        var sp = context.createScriptProcessor(
          expectedBuffers[0].length,
          gTest.numberOfChannels,
          0
        );
        nodeToInspect.connect(sp);
        sp.onaudioprocess = function (e) {
          var expectedBuffer = expectedBuffers.shift();
          testLength += expectedBuffer.length;
          compareBuffers(e.inputBuffer, expectedBuffer);
          if (!expectedBuffers.length) {
            sp.onaudioprocess = null;
            callback();
          }
        };
      }
      var context = new AudioContext();
      runTestOnContext(context, callback, testOutput);
    }

    function testOnOfflineContext(callback, sampleRate) {
      function testOutput(nodeToInspect, expectedBuffers, callback) {
        nodeToInspect.connect(context.destination);
        context.oncomplete = function (e) {
          var samplesSeen = 0;
          while (expectedBuffers.length) {
            var expectedBuffer = expectedBuffers.shift();
            is(
              e.renderedBuffer.numberOfChannels,
              expectedBuffer.numberOfChannels,
              "Correct number of input buffer channels"
            );
            for (var i = 0; i < e.renderedBuffer.numberOfChannels; ++i) {
              compareChannels(
                e.renderedBuffer.getChannelData(i),
                expectedBuffer.getChannelData(i),
                expectedBuffer.length,
                samplesSeen,
                undefined,
                true
              );
            }
            samplesSeen += expectedBuffer.length;
          }
          callback();
        };
        context.startRendering();
      }

      var context = new OfflineAudioContext(
        gTest.numberOfChannels,
        testLength,
        sampleRate
      );
      runTestOnContext(context, callback, testOutput);
    }

    testOnNormalContext(function () {
      if (!gTest.skipOfflineContextTests) {
        testOnOfflineContext(function () {
          testOnOfflineContext(done, 44100);
        }, 48000);
      } else {
        done();
      }
    });
  }

  if (document.readyState !== "complete") {
    addLoadEvent(runTestFunction);
  } else {
    runTestFunction();
  }
}
