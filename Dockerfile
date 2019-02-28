FROM google/cloud-sdk:slim

ARG GOOGLE_KEY_FILE="/app/keys/google-cloud-api.json"
ARG GOOGLE_PROJECT_ID="peaceful-doodad-228621"

RUN apt-get update && apt-get install -qq -y \
    curl python3-pip python3-dev

RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
RUN python3 get-pip.py
RUN pip3 install -U pip

# add all files from this dir to the image
ADD . /app
WORKDIR /app/app

RUN pip3 install -r ../requirements.txt

# authenticate google cloud
RUN gcloud auth activate-service-account \
    --key-file=$GOOGLE_KEY_FILE \
    --project=$GOOGLE_PROJECT_ID

ENV GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_KEY_FILE

CMD ["python3", "app.py"]