# Clock Screensaver

![Clock Screenshot](clock_screenshot.png)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You need to have Node.js and npm installed on your system.

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username/clock-screensaver.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```

## Usage

To start the screensaver, run the following command:

```sh
npm start
```

To run the clock in normal windowed mode (no auto-quit on mouse movement), run:

```sh
npm run start:windowed
```

To quickly verify JavaScript syntax before packaging, run:

```sh
npm run check
```

To open the settings, run:

```sh
npm run settings
```

Windows screensaver command switches are also supported:

```sh
electron . /s   # full screensaver mode
electron . /c   # settings dialog
electron . /p   # preview mode (currently exits)
electron . --windowed  # normal app window mode
```

## Building

To build a portable version of the screensaver, run:

```sh
npm run build
```

To build an installer for Windows, run:

```sh
npm run build:installer
```

## License

Distributed under the ISC License. See `LICENSE` for more information.
