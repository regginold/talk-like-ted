# stats.py

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer


def count_words(google_speech, include_stop_words=False, return_top_n=10):
    """Counts the number of occurrences of each word in a speech's transcript.

    Parameters
    ----------
    google_speech : GoogleSpeech

    include_stop_words : bool (optional, default=False)
        Whether stop words should be included.

    return_top_n : int (optional, default=10)
        How many words should be returned?

    Returns
    -------
    list of dict :
        Each item in the list is a dict like {'word': <word>, 'count': <count>}
    """
    if include_stop_words:
        stop_words = None
    else:
        stop_words = 'english'

    transcript = google_speech.transcript_as_string()
    vectorizer = CountVectorizer(stop_words=stop_words)

    counts = vectorizer.fit_transform([transcript]).toarray().flatten().tolist()

    # make sure that we have enough words to return.
    if len(counts) < return_top_n:
        return_top_n = len(counts)

    top_n_ixs = np.argsort(counts)[-return_top_n:][::-1]

    words = vectorizer.get_feature_names()
    data = []
    for ix in top_n_ixs:
        data.append({'word': words[ix], 'count': counts[ix]})

    return data


def words_per_min_array(gs, bin_size_sec=10, num_points_to_return=60):
    """Get the windowed number of words spoken per minute.

    Parameters
    ----------
    gs : GoogleSpeech
        Speech to find windowed number of words per min.

    bin_size_sec : int
        How big the sliding window should be (in seconds)

    num_points_to_return : int
        How many values should be returned? Each value will be the average of
        a window.

    Returns
    -------
    words_per_min : np.array
    transcript : list of string
        Contains transcript associated with wpm.
    """
    timestamps = np.asarray(gs.mean_timestamps()).astype(np.int)

    counts, _ = np.histogram(timestamps, bins=np.arange(np.max(timestamps) + 2))
    windowed_counts = np.convolve(counts, np.ones(bin_size_sec), 'same')

    ixs = np.linspace(0, windowed_counts.size - 1, num_points_to_return).astype(np.int)
    avgs = []

    transcript = gs.transcript_as_list()
    transcript_chunks = []
    start_ix = 0
    for i in range(ixs.size - 1):
        wc = windowed_counts[ixs[i]:ixs[i+1]]
        c = counts[ixs[i]:ixs[i+1]]
        num_words_in_window = int(np.sum(c))
        avgs.append(np.mean(wc))
        transcript_chunks.append(' '.join(transcript[start_ix:(start_ix + num_words_in_window)]))
        start_ix += num_words_in_window
    avgs.append(np.mean(windowed_counts[ixs[i+1]:]))
    transcript_chunks.append(' '.join(transcript[start_ix:]))

    wpms = np.asarray(avgs).flatten() / (bin_size_sec / 60)

    return [{'wpm': wpms[i], 'transcript': transcript_chunks[i]} for i in range(len(wpms))]


def get_running_words_per_min(google_speech, num_values_to_return=60):
    """Gets the running average of the user's speech speed.

    Parameters
    ----------
    google_speech : GoogleSpeech
    num_values_to_return : int (optional, default=60)
        If this is less than the length of the user's speech (in seconds),
        then the speech will be evenly split into `num_values_to_return` bins
        and the average running average within that bin will be returned.

    Returns
    -------
    bin_sizes : list of int (or -1)
        Each bin size will be one of [1, 5, 10, 30, 60] seconds in lenght;
        the elements in this list is dependent on the length of the speech.
        If -1, then the speech was < 10 seconds.

    running_words_per_min : dict
        Each key is a bins size, and each value is a list of dicts, like:
        {'wpm': <wpm>, 'transcript': <transcript>}
    """
    duration_sec = int(np.max(google_speech.mean_timestamps()))

    # don't return anything if the speech is less than 10 seconds
    if duration_sec <= 10:
        return -1, -1
    elif duration_sec <= 30:
        num_values_to_return = 10
        bin_sizes = [1, 5, 10]
    elif duration_sec <= 60:
        num_values_to_return = 30
        bin_sizes = [1, 5, 10, 30]
    else:
        bin_sizes = [1, 5, 10, 30, 60]

    data = {}
    for bin_size in bin_sizes:
        data[bin_size] = words_per_min_array(
            google_speech,
            bin_size_sec=bin_size,
            num_points_to_return=num_values_to_return
        )

    return bin_sizes, data