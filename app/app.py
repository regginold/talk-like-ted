import os
import time
import dill

from flask import (
    Flask,
    render_template
)

from flask_socketio import (
    SocketIO,
    emit
)

import numpy as np
from scipy.io import wavfile
from google.cloud import speech

from streaming.speech import (
    Speech,
    GoogleSpeech
)
from streaming.streaming import AudioStream
from streaming.stats import (
    count_words,
    words_per_min_array,
    get_running_words_per_min
)
from streaming.utils import (
    generate_unique_filename,
    format_transcript_data
)


app = Flask(__name__)
app.config.from_object('config.Dev')

socketio = SocketIO(app)

app.example_speech_pkd_response_filename = (
    "data/Aala El-Khani -- What it's like to be a parent in a war zone.pkd"
    )
app.example_speech = None
app.example_speech_num_topics = 5

app.num_user_recordings = 0
app.audio = []
app.sample_rate = None
app.audio_record_start_time = None
app.audio_record_secs_elapsed = None

app.language_code = 'en-US'
app.audio_stream = None
app.audio_stream_started = False
app.waiting_for_responses_callback_sig = True

app.transcript = ''           # current transcript across all responses
app.prev_num_responses = 0    # number of previous is_final responses
app.responses = []            # this contains all of the is_final responses
app.speeches = []             # all of the responses that have been converted to
                              # GoogleSpeech objects.


@socketio.on('connect stream.html')
def stream_connection_established():
    """Callback function once the socket has been established on stream.html"""
    print('connected to stream.html')
    emit('update timer', '00:00')

    if app.config['LOAD_FAKE_USER_DATA']:
        with open(app.example_speech_pkd_response_filename, 'rb') as f:
            responses = dill.load(f)
        app.example_speech = GoogleSpeech(responses, num_topics=5)
        app.speeches.append(app.example_speech)
        analyze_user_google_speech(app.example_speech)


def emit_example_speech(num_topics):
    """Sends an example speech to example.html to show the user some example
    output from a long (~15 minute) talk."""
    # open and load an example speech from a pickled (dill) file if the app
    # has not yet loaded the speech. Otherwise, just update the number of topics
    # in the LDA.
    if app.example_speech is None:
        with open(app.example_speech_pkd_response_filename, 'rb') as f:
            responses = dill.load(f)
        app.example_speech = GoogleSpeech(responses, num_topics=num_topics)
    else:
        app.example_speech.fit_lda(n_topics=num_topics)

    analyze_user_google_speech(app.example_speech, mode='example')


@socketio.on('connect example.html')
def example_connection_established():
    """Function called once the socket has been established on example.html"""
    print('connected to example.html')
    emit_example_speech(app.example_speech_num_topics)


#---------AUDIO STREAMING---------------------------#
def wpm_from_transcript(transcript):
    """Calculates the current number of words per minute from the given
    transcript."""
    num_words = len(transcript.split())
    elapsed_time_sec = time.time() - app.audio_record_start_time
    wpm = num_words / elapsed_time_sec * 60
    # print(num_words, elapsed_time_sec)
    if elapsed_time_sec < 1:
        return 0
    return wpm


def emit_time():
    """Emits a signal if a second has elapsed, to update the users presentation
    clock."""
    secs_elapsed = np.floor(time.time() - app.audio_record_start_time)
    if app.audio_record_secs_elapsed != secs_elapsed:
        app.audio_record_secs_elapsed = secs_elapsed
        mins_elapsed = int(secs_elapsed / 60)
        secs_elapsed -= (60 * mins_elapsed)
        emit(
            'update timer',
            '{:02}:{:02}'.format(mins_elapsed, int(secs_elapsed))
        )


def emit_transcript_text():
    """Updates the transcript text in the streaming transcript div"""
    app.transcript = app.audio_stream.transcript
    emit('transcript update', {'transcript': app.audio_stream.transcript})


def emit_wpm_from_streaming_transcript():
    """Calculates the current number of words per minute based on the
    number of words currently in the streaming transcript."""
    wpm = wpm_from_transcript(app.audio_stream.transcript)
    emit('wpm', {'words-per-minute': str(int(wpm))})
    emit('wpm plot update', int(wpm))


def emit_wpm_from_full_transcript(transcript):
    """Uses the full transcript to calculate the wpm."""
    wpm = wpm_from_transcript(transcript)
    emit('wpm', {'words-per-minute': str(int(wpm))})
    emit('wpm plot update', int(wpm))


@socketio.on('language changed')
def language_changed(new_language):
    """Called when the user changes the language."""
    app.language_code = new_language
    print('new language selected: ', new_language)


@socketio.on('audio stream load page')
def audio_load_page(sample_rate):
    """Called when /stream finishes loading"""
    app.sample_rate = sample_rate


@socketio.on('audio stream on')
def audio_on(sample_rate):
    """Called when the user hits the start recording button"""
    app.audio = []
    app.responses = []
    app.num_user_recordings += 1
    app.prev_num_responses = 0
    app.waiting_for_responses_callback_sig = True

    # create a new thread which will stream the audio
    app.audio_stream = AudioStream(sample_rate, language_code=app.language_code)
    app.audio_stream.closed = False
    app.audio_record_start_time = time.time()
    app.audio_record_secs_elapsed = 0
    emit('update timer', '{:02}:{:02}'.format(0, 0))

    app.audio_stream.start()
    app.audio_stream_started = True
    emit('remove plots')


@socketio.on('audio stream')
def audio_stream(stream):
    """Called whenever a chunk of audio is emitted from the AudioStream object.

    Parameters
    ----------
    stream : dict
        keys are 'sample_rate' and 'audio'. 'sample_rate' is audio sample rate
        in Hz. 'audio' is an array of size 4096 containing raw audio signal as
        type uint16.

    Emits
    -----
    'update timer' (via emit_time())
    'transcript update' (via emit_transcript_text())
    'wpm' (via emit_wpm_from_full_transcript() or
               emit_wpm_from_streaming_transcript())
    'wpm plot update' (via emit_wpm_from_full_transcript() or
                           emit_wpm_from_streaming_transcript())
    """
    audio = stream['audio']
    app.audio.extend(audio)
    app.audio_stream.add_chunk(audio)

    emit_time()

    # update the transcript if there are new words
    if app.transcript != app.audio_stream.transcript:
        emit_transcript_text()

    # now we're going to lose track of our responses when a new
    # stream is opened!!

    # need to check to see when the transcript is disappearing....

    # if an is_final response has occurred, add the response object
    if len(app.audio_stream.responses) != app.prev_num_responses:
        app.prev_num_responses = len(app.audio_stream.responses)
        if app.config['DEBUG']:
            print('audio stream responses: ', len(app.audio_stream.responses))
        app.responses.append(app.audio_stream.responses[-1])

    if len(app.responses) != 0:
        # TODO: combine word count from previous responses and num words in
        # streaming transcript
        quick_speech = Speech(app.responses)
        qs_transcript_list = quick_speech.transcript_as_list()
        qs_transcript_string = quick_speech.transcript_as_string()

        # if len(qs_transcript_list) > len(app.transcript.split()) \
        #     and app.transcript not in qs_transcript_string:
        # NOTE: this could be inefficient in cases where the qs_transcript
        # string is long
        if app.transcript not in qs_transcript_string:
            full_transcript = (
                qs_transcript_string + ' ' +
                app.transcript
            )
        else:
            full_transcript = qs_transcript_string

        if app.config['DEBUG']:
            print('-----')
            print('num_responses: ', len(app.responses))
            print('qs len: ', len(qs_transcript_list))
            print('app.transcript len: ', len(app.transcript.split()))
            print('current wpm: ', wpm_from_transcript(full_transcript))
            print()

        emit_wpm_from_full_transcript(full_transcript)
    else:
        emit_wpm_from_streaming_transcript()


@socketio.on('audio stream off')
def audio_off():
    """Executed when the user hits the 'stop' button."""
    # clear out any previous recordings from the temp file.
    if not os.path.exists('static/temp'):
        os.mkdir('static/temp')

    for fname in os.listdir('static/temp'):
        os.remove(os.path.join('static/temp', fname))

    app.audio_stream.closed = True
    count = 0
    waiting_emitted = False
    while True:
        if app.audio_stream.is_finished() and \
           not app.audio_stream.waiting_for_responses:
            gs = GoogleSpeech(app.audio_stream.responses, num_topics=5)
            app.speeches.append(gs)
            emit('transcript update', {'transcript': gs.transcript_as_string()})
            analyze_user_google_speech(gs)
            print(
                'Conversion to GoogleSpeech object was a success (audio_off).'
            )
            emit('waiting for responses complete')
            break
        else:
            if not waiting_emitted:
                # TODO: place this on another thread so that we can wait for
                # the callback from 'waiting for responses' signal. (this will
                # just lead to an infinite loop).
                emit('waiting for responses')
                waiting_emitted = True

            if count >= 5:
                break
            count += 1
            print('Conversion to GoogleSpeech object did not work (audio_off). ' +
                'Trying again in 1 sec.')
            time.sleep(1)

    # create a unique filename for this audio file
    # this is so the browser will load a cached audio file
    filename = 'static/temp/' + generate_unique_filename(20, '.wav')
    audio = (np.asarray(app.audio).astype(np.float32) * 0x7FFF).astype(np.int16)
    wavfile.write(filename, app.sample_rate, audio)

    with open('static/temp/example-responses.pkd', 'wb') as f:
        dill.dump(app.audio_stream.responses, f)

    emit('create audio url', filename)


@socketio.on('waiting for responses callback')
def waiting_for_responses_callback():
    app.waiting_for_responses_callback_sig = False


@socketio.on('update lda topics')
def update_lda_topics(num_topics):
    """Updates the number of topics in the user's LDA on the /stream page.

    Parameters
    ----------
    num_topics : int
        How many topics to update the user's LDA to include.

    Emits
    -----
    'topic modeling'
    """
    gs = app.speeches[-1]
    gs.fit_lda(int(num_topics))
    emit('topic modeling', gs.get_all_topics(10))


@socketio.on('example update lda topics')
def update_example_lda_topics(num_topics):
    """Updates the number of topics in the LDA on the /example page.

    Parameters
    ----------
    num_topics : int
        How many topics to update the LDA to include.

    Emits
    -----
    'topic modeling'
    """
    gs = app.example_speech
    gs.fit_lda(int(num_topics))
    emit('topic modeling', gs.get_all_topics(10))


def analyze_user_google_speech(google_speech, mode='user'):
    """Analyzes a user's speech and emits data to stream.html

    Parameters
    ----------
    google_speech : GoogleSpeech
    mode : string (options are 'user' or 'example')
        If mode == 'user', 'speech processing done' is emitted along with the
        other values emitted.

    Emits
    -----
    'speech processing done' (if mode == 'user')
    'word counts including stop'
    'word counts excluding stop'
    'update speech dt slider'
    'made speech dt plot'
    'topic modeling'
    """
    if mode not in ['user', 'example']:
        raise AttributeError('`mode` must be either \'user\' or \'example\'')

    transcript_data = format_transcript_data(google_speech)
    word_data_excluding_stop = count_words(
        google_speech, include_stop_words=False, return_top_n=10
    )
    word_data_including_stop = count_words(
        google_speech, include_stop_words=True, return_top_n=10
    )

    if mode == 'user':
        emit('speech processing done')

    emit(
        'word counts including stop',
        {'counts': word_data_including_stop, 'transcript': transcript_data}
    )
    emit('word counts excluding stop', word_data_excluding_stop)

    # and plot the running average of wpm values.
    bin_sizes, data = get_running_words_per_min(google_speech)
    if bin_sizes != -1:
        emit('update speech dt slider', bin_sizes)
        emit('make speech dt plot', data)
    else:
        emit('speech less than 10 seconds')

    # and emit the topics
    emit('topic modeling', google_speech.get_all_topics(10))


#==============ROUTING==============================#
@app.route('/', methods=['GET', 'POST'])
def stream():
    return render_template(
        'stream.html',
        upgrade_insecure_requests=app.config['UPGRADE_INSECURE_REQUESTS']
    )


@app.route('/example')
def example():
    return render_template(
        'example.html',
        upgrade_insecure_requests=app.config['UPGRADE_INSECURE_REQUESTS']
    )


@app.route('/about')
def about():
    return render_template(
        'about.html',
        upgrade_insecure_requests=app.config['UPGRADE_INSECURE_REQUESTS']
    )


@app.route('/contact')
def contact():
    return render_template(
        'contact.html',
        upgrade_insecure_requests=app.config['UPGRADE_INSECURE_REQUESTS']
    )


if __name__ == '__main__':
    socketio.run(
        app,
        debug=app.config['DEBUG'],
        host=app.config['HOST'],
        port=app.config['PORT']
    )