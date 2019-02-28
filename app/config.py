# configuration variables for app.py

class BaseConfig(object):
    ENV = 'production'
    DEBUG = False
    TESTING = False

    # we need to make sure we're using HTTPS on heroku, and HTTP in development
    # therefore, this variable will just insert a tag into the template for each
    # page that will upgrade HTTP to HTTPS for production.
    UPGRADE_INSECURE_REQUESTS = ('<meta http-equiv="Content-Security-Policy" ' + 
        'content="upgrade-insecure-requests">')
    LOAD_FAKE_USER_DATA = False
    HOST = '0.0.0.0'


class Dev(BaseConfig):
    """Prints all debugging statements, and makes sure app will run on 
    insecure docker server."""
    ENV = 'development'
    DEBUG = True
    UPGRADE_INSECURE_REQUESTS = ''


class DevFakeData(Dev):
    """Loads user data onto stream.html"""
    LOAD_FAKE_USER_DATA = True


class Production(BaseConfig):
    pass


class Testing(BaseConfig):
    TESTING = True
