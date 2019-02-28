import os
import sys
import dill
from copy import deepcopy

import numpy as np

from sklearn.neighbors import KNeighborsClassifier
from sklearn.cluster import KMeans
from sklearn.utils.validation import check_is_fitted
from sklearn.exceptions import NotFittedError

from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import NMF, LatentDirichletAllocation


class Speech(object):
    """Generates a usable data structure from Google Responses."""
    def __init__(self, responses):
        self.responses = responses

    def transcript_as_string(self):
        """Get the full transcript, compiled across responses."""
        t = []
        for response in self.responses:
            t.append(response.alternatives[0].transcript)
        return ''.join(t)

    def transcript_as_list(self):
        """Returns the transcript as a list of words."""
        return self.transcript_as_string().split()


class GoogleSpeech(object):
    def __init__(self, responses, num_topics=8):
        """Class to more easily get information out of speech responses.

        Parameters
        ----------
        responses : list of google.cloud.speech_v1.types.SpeechRecognitionResult
            Each response represents a single 'chunk' of the speech.

        num_topics : int (optional, default=8)
            The number of topics to search for in a given speech via LDA.
        """
        # make a copy of this since we are going to be altering the timestamps
        self.responses = deepcopy(responses)
        if len(self.responses) > 1:
            self._update_timestamps()

        self.num_topics = num_topics

        # create a KMeans classifier to find short and long pauses in speech,
        # and fit it to our data.
        self.kmeans_pause = KMeans(n_clusters=2)
        self._fit_kmeans()

        # fit an LDA model using the transcript.
        self.fit_lda(num_topics)

    def get_timestamp_secs(self, timepoint='start_time'):
        """
        Returns
        -------
        timestamps : np.array
            The timestamps for each word across all responses.

        response_ixs : np.array
            The response to which each timestamp belongs.
        """
        timestamps = []
        response_ixs = []
        for ix, response in enumerate(self.responses):
            for word in response.alternatives[0].words:
                timestamps.append(getattr(word, timepoint).seconds)
                response_ixs.append(ix)

        return np.asarray(timestamps), np.asarray(response_ixs)

    def get_updated_seconds(self):
        """Gets the correct (updated) start and end times for each word spoken
        across all responses.

        Returns
        -------
        new_start_times (seconds)
        new_end_times (seconds)
        """
        # get all of the start and end times for every word
        start_times, response_ixs = self.get_timestamp_secs('start_time')
        end_times, _ = self.get_timestamp_secs('end_time')

        # get the mean time of each word
        mean_times = (start_times + end_times) / 2

        # calculate where one word comes before the next --
        # this is where the response times need to be updated
        diffs = np.diff(mean_times)
        diffs_neg = np.where(diffs < 0)[0]
        response_diff_neg = response_ixs[diffs_neg + 1]

        # determine how much time should be added to each word in each response.
        # add 1 second to these times to make sure these words are non-overlapping
        add_to_responses = np.cumsum(np.abs(diffs[diffs_neg])).astype(np.int) + 1

        # update the times
        new_start_times = []
        new_end_times = []
        for i, response in enumerate(self.responses):
            starts = start_times[response_ixs == i]
            ends = end_times[response_ixs == i]
            if i in response_diff_neg.tolist():
                starts += add_to_responses[response_diff_neg == i]
                ends += add_to_responses[response_diff_neg == i]
            new_start_times.extend(starts.tolist())
            new_end_times.extend(ends.tolist())

        return new_start_times, new_end_times

    def _update_timestamps(self):
        """Updates all of the timestamps for each word across all responses."""
        new_start_sec, new_end_sec = self.get_updated_seconds()
        counter = 0
        for response in self.responses:
            for word in response.alternatives[0].words:
                word.start_time.seconds = new_start_sec[counter]
                word.end_time.seconds = new_end_sec[counter]
                counter += 1

    def transcript_as_list(self):
        """Returns the transcript as a list of words."""
        return self.transcript_as_string().split()

    def transcript_as_string(self):
        """Get the full transcript, compiled across responses."""
        t = []
        for response in self.responses:
            t.append(response.alternatives[0].transcript)
        return ''.join(t)

    def transcript_split_on_pause(self):
        """Splits a transcript based on where `long` pauses occur."""
        _, long_pause_ix = self._pause_labels()
        trans = self.transcript_as_list()
        splits = []
        split_ixs = [0] + (np.where(long_pause_ix)[0] + 1).tolist()
        for i in range(len(split_ixs) - 1):
            splits.append(' '.join(trans[split_ixs[i]:split_ixs[i+1]]))
        return splits

    def mean_timestamps(self):
        """Get the mean timestamp for each word spoken."""
        timestamps = []
        for response in self.responses:
            for word in response.alternatives[0].words:
                start = word.start_time.seconds + word.start_time.nanos * 1e-9
                end = word.end_time.seconds + word.end_time.nanos * 1e-9
                timestamps.append(np.mean([start, end]))
        return timestamps

    def words_per_min(self):
        timestamps = self.mean_timestamps()
        start_time_sec = timestamps[0]
        end_time_sec = timestamps[-1]
        duration_min = (end_time_sec - start_time_sec) / 60
        num_words_spoken = len(self.transcript_as_list())
        return num_words_spoken / duration_min

    def _fit_kmeans(self):
        """Fits and returns a KMeans classifier to find long/short pauses in speech."""
        pause_duration = np.diff(self.mean_timestamps())
        self.kmeans_pause.fit(pause_duration.reshape(-1, 1))

    def _pause_labels(self, split_metric='std'):
        """Gets labels for where short and long pauses occurred in speech.

        Parameters
        ----------
        split_metric : string (optional, default='std')
            How to split the transcript. Based on pauses found via k-means
            clustering ('kmeans') or using the mean pause duration + 1 standard
            deviation ('std').

        Returns
        -------
        short_pauses : bool
            Indexes containing short pauses are True.

        long_pauses : bool
            Indexes containing long pauses are True.
        """
        pause_duration = np.diff(self.mean_timestamps())

        if split_metric == 'kmeans':
            labels = self.kmeans_pause.labels_.astype(np.bool)
        else:
            labels = pause_duration > self.std_threshold()

        class_0_pauses = pause_duration[~labels]
        class_1_pauses = pause_duration[labels]

        if np.mean(class_0_pauses) > np.mean(class_1_pauses):
            short_pauses = labels
            long_pauses = ~labels
        else:
            short_pauses = ~labels
            long_pauses = labels

        return short_pauses, long_pauses

    def std_threshold(self):
        """Finds the threshold for splitting between short and long pauses by taking
        the mean + 1 standard deviation of the average time between words as 'long'"""
        pause_duration = np.diff(self.mean_timestamps())
        mean_diff = np.mean(pause_duration)
        std_diff = np.std(pause_duration)
        return mean_diff + std_diff

    def kmeans_pause_threshold(self):
        """Finds the threshold between short and long pauses using KMeans clustering."""
        pause_duration = np.diff(self.mean_timestamps())
        short_pause_ix, long_pause_ix = self._pause_labels()
        short_pauses = pause_duration[short_pause_ix]
        long_pauses = pause_duration[long_pause_ix]
        return np.mean([np.max(short_pauses), np.min(long_pauses)])

    def fit_lda(self, n_topics=8):
        """Fits an LDA to this speech transcribed by Google Speech API.

        Parameters
        ----------
        n_topics : int
            How many topics to search for within the speech

        Attributes
        ----------
        These attributes are set upon a call to `fit_lda`.

        vectorizer : CountVectorizer
            Used to create word counts for this speech.

        model : LatentDirichletAllocation
            Fit to passed speech.

        model_Z : np.array of shape (N_documents, n_topics)
            These are the weights of each of the documents for each of the
            topics found via LDA.
        """
        vectorizer = CountVectorizer(stop_words='english', lowercase=True)
        vectorized_speech = vectorizer.fit_transform(self.transcript_split_on_pause())

        lda_model = LatentDirichletAllocation(n_components=n_topics, max_iter=10, learning_method='online')
        lda_Z = lda_model.fit_transform(vectorized_speech)

        self.vectorizer = vectorizer
        self.lda_model = lda_model
        self.lda_Z = lda_Z

    def get_topic_proportions(self):
        return self.lda_Z.mean(axis=0)

    def get_all_topics(self, top_n=25):
        """Gets all the topics in a format that can be plotted by `linked_charts.js`."""
        data = []
        proportions = self.get_topic_proportions()
        vec_feature_names = self.vectorizer.get_feature_names()
        for ix, topic in enumerate(self.lda_model.components_):
            topic_data = {'proportion': proportions[ix]}
            topic_data['topic'] = 'Topic {}'.format(ix+1)
            topic_data['categories'] = []
            for i in topic.argsort()[:-top_n - 1:-1]:
                topic_data['categories'].append({'name': vec_feature_names[i], 'value': topic[i]})
            data.append(topic_data)
        return data


class TedSpeech(object):
    """This class will generate an object for analyzing transcript data
    scraped from the TED.com website."""
    def __init__(self, transcript, duration_min):
        self.transcript = transcript
        self.duration_min = None
