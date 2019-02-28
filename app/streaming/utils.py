# utils.py

import numpy as np


def generate_unique_filename(num_chars, extension='.wav'):
    """Makes a unique filename from alphanumeric characters.

    Parameters
    ----------
    num_chars : int
        How long should the filename be.

    extension : string (optional, default='.wav')
        The extension to append to the end of the random string.

    Returns
    -------
    fname : string
        Random string with extension appended.
    """
    fname_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    ixs = np.random.randint(0, len(fname_chars), num_chars)
    return ''.join([fname_chars[ix] for ix in ixs]) + extension


def format_transcript_data(google_speech):
    """Formats transcript data so that it can be plotted by D3.

    Parameters
    ----------
    google_speech : GoogleSpeech

    Returns
    -------
    list of dict
        Each item is a single word in the transcript, like [{'word': <word>}]
    """
    transcript = google_speech.transcript_as_list()
    data = []
    for word in transcript:
        data.append({'word': word})
    return data