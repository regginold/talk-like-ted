
import time

import threading
import numpy as np

from six.moves import queue
from google.cloud import speech


def get_current_time():
    return int(round(time.time() * 1000))

def duration_to_secs(duration):
    return duration.seconds + (duration.nanos / float(1e9))


class AudioStream(threading.Thread):
    """Stream for passing audio data to GCS.

    Parameters
    ----------
    sample_rate : int
        Sample rate of audio signal (in Hz).

    stream_limit_ms : int (optional, default=50000)
        Limit on how long the stream can be kept open (in milliseconds). Note
        that GCS will not process streams longer than 60 seconds in length.
    """
    def __init__(self, sample_rate, language_code='en-US', stream_limit_ms=50000):
        threading.Thread.__init__(self)
        self.sample_rate = sample_rate
        self.stream_limit_ms = stream_limit_ms
        self.language_code = language_code
        self.waiting_for_responses = False

        self.buffer = queue.Queue()
        self.closed = True
        self.start_time = get_current_time()
        self.transcript = ''
        self.num_requests = 1
        self.responses = []

        self.client = speech.SpeechClient()
        self.config = speech.types.RecognitionConfig(
            encoding=speech.enums.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=sample_rate,
            language_code=language_code,
            max_alternatives=1,
            enable_word_time_offsets=True,
            enable_automatic_punctuation=True
        )
        self.streaming_config = speech.types.StreamingRecognitionConfig(
            config=self.config,
            interim_results=True
        )

    def run(self):
        """Run thread."""
        self.streaming_audio_loop()

    def streaming_audio_loop(self):
        """Start streaming audio to GCS."""
        while not self.is_finished():
            print('running audiostream')
            self.waiting_for_responses = True
            gen = self.generator()
            responses = self.client.streaming_recognize(
                self.streaming_config,
                (speech.types.StreamingRecognizeRequest(audio_content=content) for content in gen)
                )

            self.analyze_responses(responses)

    def analyze_responses(self, resp):
        """Checks streaming responses and appends is_final responses to
        `self.responses`. Also updates `self.transcript` with the most current
        transcript.

        Parameters
        ----------
        resp : list of StreamingRecognizeResponse
        """
        responses = (r for r in resp if r is not None)
        for response in responses:
            if not response.results:
                continue
            result = response.results[0]
            if not result.alternatives:
                continue
            # only append a result if it has an `is_final` flag.
            if result.is_final:
                self.responses.append(result)

            self.transcript = result.alternatives[0].transcript
        self.waiting_for_responses = False

    def add_chunk(self, chunk):
        """Adds a chunk of audio to the stream's buffer.

        Parameters
        ----------
        chunk : list of float
            This is raw audio signal. Note that each value in the list must be
            between 0 and 1.
        """
        # convert from float to int16
        scaled_chunk = (np.asarray(chunk).astype(np.float32) * 0x7FFF).astype(np.int16)
        self.buffer.put(scaled_chunk.tobytes())

    def is_finished(self):
        """Checks whether both the stream is closed and the chunk buffer is empty.

        Returns
        -------
        is_finished : bool
        """
        return self.closed and self.buffer.empty()

    def send_silence(self, seconds=1, num_chunks=5):
        """This function simply yields a specified number of seconds of silence,
        with a time delay.

        Parameters
        ----------
        seconds : int (optional, default=1)
        num_chunks : int (optional, default=5)
        """
        for i in range(num_chunks):
            yield np.zeros(int(self.sample_rate/num_chunks)).astype(np.int16).tobytes()
            time.sleep(seconds/num_chunks)

    def generator(self):
        """Generator which yields chunks of audio."""
        while not self.is_finished():
            if get_current_time() - self.start_time > self.stream_limit_ms:
                # spit out a second's worth of 'silence' to make sure we
                #       get an is_final flag.
                for silent_chunk in self.send_silence():
                    yield silent_chunk
                print('max time exceeded, starting a new request.')
                self.num_requests += 1
                self.start_time = get_current_time()
                break

            # this uses a blocking operation to make sure that we are
            # actually pulling something from the stream.. set the timeout to
            # 300 ms, so when the user hits the stop button, this loop
            # doesn't get stuck (which will trigger a timeout error on GCS).
            try:
                chunk = self.buffer.get(block=True, timeout=0.3)
            except queue.Empty:
                # send 'silence' to GCS for a second, then return;
                # this essentially makes sure that an is_final flag will be
                # returned.
                for silent_chunk in self.send_silence():
                    yield silent_chunk
                return

            data = [chunk]

            # then collect any chunks that are left in the buffer.
            while True:
                try:
                    chunk = self.buffer.get(block=False)
                    data.append(chunk)
                except queue.Empty:
                    break

            yield b''.join(data)