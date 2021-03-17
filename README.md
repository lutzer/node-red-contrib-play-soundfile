# node-red-contrib-play-soundfile

Plays a sound file on the system. Allows to set up a base directory which contains all the sound files. If no absolute directory path is supplied it will look for the file relative to the project directory.

![config](docs/config.png)

## Installation

* Via Manage Palette -> Search for "node-red-contrib-play-soundfile"
* Via terminal: `cd ~/node-red; npm install node-red-contrib-play-soundfile`

## Requirements

The node relies on https://github.com/shime/play-sound. One of the following players needs to be installed on the system:

* mplayer
* afplay
* mpg123
* mpg321
* play
* omxplayer
* aplay
* cmdmp3

## Usage

* see node help
