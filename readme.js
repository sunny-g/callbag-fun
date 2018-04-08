/***************************************************************************
  SINKS
    consumes data from a source, either by being pushed data or by requesting data

  HANDSHAKE:
    when sink is called with 0, store talkback
    when sink wants data, call `talkback(1)`
 ***************************************************************************/
// listener sink
const listener = {
  listen: (type, data) => {
    if (type === 0) {
      const talkback = data;
      // do something with talkback, like call it and dispose of the source
    }

    if (type === 1) {
      // source produced some data
    }

    if (type === 2 && data !== undefined) {
      const error = data;
      // source produced an error
      // (if necessary) do some cleanup
    }

    if (type === 2 && data === undefined) {
      // source is done producing data
      // (if necessary) do some cleanup
    }
  }
};

// puller sink
const puller = {
  interval: (period) => {
    let handle = null;

    return function sink(type, data) {
      if (type === 0) {
        const talkback = data;

        // in this case, pull every `period`
        handle = setInterval(() => talkback(1), period);
      }

      if (type === 1) {
        // in this case, just log the data
        console.log(data);
      }

      if (type === 2) {
        // in this case, cleanup the timeout
        clearInterval(handle);
      }
    }
  }
};

// basic logging sink
  // consume from both listenable and pullable sources
  // done by calling `talkback(1)` after handshake on each value (to get the next)
const log = inputSource => {
  let talkback;

  console.log('initiating handshake');

  inputSource(0, function logSink(type, data) {
    if (type === 0) {
      talkback = data;
      console.log('handshake complete');
      talkback(1);
    }

    if (type === 1) {
      console.log('data message received:', data);
      talkback(1);
    }

    if (type === 2) {
      (data === undefined)
        ? console.log('complete message received')
        : console.log('error message received:', data);
      console.log('done');
      talkback(type, data);
    }
  })
}

/***************************************************************************
  SOURCES
    produces data, either on it's own schedule, or when asked by a sink

  HANDSHAKE:
    when source is called with 0, create:
      - a producer that will call the sink on next + error/complete
      - a talkback for the sink
    then call `sink(0, talkback)`

  TALKBACK:
    called when:
      - requesting more data from the source
      - unsubscribing from the source
 ***************************************************************************/
// listenable source
const listenable = {
  interval: (period) => (start, sink) => {
    if (start !== 0) { return; }

    /*
      producer is a setInterval that will send `null` once per second
      in this case, the talkback disposes of the producer
     */
    let counter = 0;
    const handle = setInterval(() => sink(1, counter++), period);

    sink(0, function listenableSourceTalkback(type) {
      if (type === 2) { clearInterval(handle); }
    });
  }
};

// pullable source
const pullable = {
  firstN: (maxCount) => (start, sink) => {
    if (start !== 0) { return; }

    /*
      producer is a counter, incremented each time it is requested
      after it is called 5 times, it sends a type 2
     */
    let counter = 0;

    sink(0, function pullableTalkback(type) {
      (type === 1) && (counter <= maxCount)
        ? sink(1, counter++) : (type === 1)
        ? sink(2)
        : void 0;
    });
  }
};

/***************************************************************************
  OPERATORS
    takes a source as input, returns a new source
    general API:
      const operator = (...args) => inputSource => outputSource;
 ***************************************************************************/

function pipe(source, ...ops) {
  return ops.reduce((res, op) => op(res), source);
}

const multiplyBy = factor => inputSource => {
  return function multiplyBySource(start, sink) {
    if (start !== 0) { return; }

    /*
      start with the handshake with the input source
      give it a new sink that:
        - type === 0: passes mapped data to the sink
        - else: passes through to the sink
     */
    inputSource(0, function multiplyBySink(type, data) {
      (type === 1)
        ? sink(1, data * factor)
        : sink(type, data);
    });
  };
};

const tap = tapFn => inputSource => {
  return function tapSource(start, sink) {
    if (start !== 0) { return; }

    inputSource(0, function tapSink(type, data) {
      tapFn(type, data);
      sink(type, data);
    });
  };
};

pipe(
  pullable.firstN(10),
  multiplyBy(2),
  multiplyBy(2),
  tap((t, d) => console.log('tapping:', t, d)),
  log,
);
