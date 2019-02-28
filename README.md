# talk-like-ted

Practice giving spoken presentations and get feedback in real time

## About

This repository contains code to generate a web app that helps people give better spoken presentations. It uses flask and socketio to stream a user's audio to Google's Speech-to-Text API and gives the user feedback on their speech, including monitoring their speaking rate and identifying overused words. In addition, it uses NLP to parse a user's speech into topics, and gives the user feedback about how long they spent talking about individual topics.

## Demos

### Real time pace and speech transcription

### Word usage

<video width="744" height="466" autoplay loop>
    <source src="examples/interactive_transcript.mp4" type="video/mp4">
</video>

### Pace over time

<video width="744" height="466" autoplay loop>
    <source src="examples/speed_dt.mp4" type="video/mp4">
</video>

### Topic Modeling

<video width="744" height="466" autoplay loop>
    <source src="examples/topic_modeling.mp4" type="video/mp4">
</video>

## Installation

First, clone this repository:

```bash
git clone https://github.com/regginold/talk-like-ted.git
```

To run this app, you must have a valid account on Google Cloud Console, with the *Cloud Speech-to-Text API* enabled. Create a project and enable this API, then create a new service account key and save this key somewhere within the repo.

I created a new top-level folder called `keys/` and stored the service key there (note that `keys/` is in the `.gitignore` file, so it won't be tracked by git).

Then, edit the `Dockerfile`, and update the `GOOGLE_KEY_FILE` with the path to the service account key you just downloaded and `GOOGLE_PROJECT_ID` to the ID of the project you just created.

Finally, build the docker image using `docker-compose`:

```bash
docker-compose build
```

and run it as a container:

```bash
docker-compose up
```

Then go to `localhost:8000` to use the app.