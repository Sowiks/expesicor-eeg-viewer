# EEG Viewer

    This was a small challenge as part of the interview process to the [Expesicor](https://www.expesicor.com/). The goal was to 
write a small program using a language that you do not know (and have not learned previously). The program should be able to open an eeg recording file, and to show the graphical representation of the data and some basic data statistics (mean and standard deviation). The time limit is 4 days.

The application was build using [Electron](https://www.electronjs.org/) framework.

## Installation

### Builded apps
    The repository contains stand-alone applications builded for Windows (x64) and Mac (x64) in the `eeg-viewer-win32-x64` and `eeg-viewer-darwin-x64` directories respectively. The apps contain files bigger than 100MB and [Git LFS](https://git-lfs.github.com/) is used to store them.

### Running from source
    You would need to [install Electron](https://www.electronjs.org/docs/tutorial/development-environment). Then run
    ```
    # to install necessary package. Should be run once
    npm install

    # to start the app
    npm start
    ```
