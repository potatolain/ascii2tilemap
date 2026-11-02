# ascii2retro

[<img width="800" alt="preview" src="https://github.com/user-attachments/assets/cf90180b-f9c3-4e4e-b8eb-d2c9c6d520b8" />](https://ascii2retro.nes.science)

[Try it out!](https://ascii2retro.nes.science)

ascii2retro is a quick simple way to make layouts/nametables/UIs for your retro games. The idea is simple, create ascii/unicode art,
then convert it to an image you can use. The format is fairly simple, so you can also create your own art and upload it to use the
conversion. Finally, the converter is provided as a standalone script/binary, should you want to use this in your own build pipelines.

The conversion is fairly simple, you have an ascii table - optionally adjusted by an arbitrary number of bytes - then each character
can be overridden with a custom replacement byte value.

Note that right now this tool is a hobby project thrown together in a few free hours, so it's pretty rough around the edges. The main
file is huge, I'm using some older React tools, and the editor isn't as efficient as it could be. My goal was more to get something
usable than something well-polished.

Enjoy!

## Features

- Console-agnostic - supports any screen size, and output format is customizable to whatever memory size your console uses
- Simple - can you use a text editor? You can probably figure this out
- Web-based - nothing to download

## Future wishlist items

- implement select tool with drag, delete
- Make file util a separate file and binary
- Support copy/paste?
- Support undo/redo?
- Add a Fill tool?

## File format

ASCII files are just plain txt files, and meant to be easily user editable! The format aims to be somewhat self-explanatory, here's
the breakdown:

### Section 1: Parameters

The top of the file is a list of parameters - with the name on the left, followed by a colon (`:`) and a space, then the value. The expected values are:

- Name: The name to use for exports, Alphanumeric characters and spaces only.
- Width: the width of the image in characters
- Height: The height of the image in characters
- Output Size: One of: 8, 16, 32 or 64. This is the size in bytes of each output value in the exports. Mostly used for binary formats.
- ASCII Offset: A numeric offset to apply to any characters that aren't given an override in the translations section. This can be negative, and can be an integer, a hex number (prefix with `0x` or `$`), or binary (prefix with `0b` or `%`)

Section 1 must be ended with two consecutive newline (`\n`) characters.

### Section 2: ASCII art

This section is very simple, it's just your ascii art, as drawn in the UI. One character on on screen
is one character in this section. Each line is dilineated by a single newline.

This section is ended by two consecutive newline (`\n`) characters.

### Section 3: Translations

This section allows you to define translations for any characters that should not use the default behavior.
It consists of a single ascii character as it would appear in the ascii section, a colon, a space, then the
value to use for that character.

By default, any character in the ascii art section will be replaced with its ascii code value, summed with the
value in `ASCII Offset`. If a character is not in this section, or it appears in this section with the value
"null", the default behavior will be used.

The value can be an integer, as well as a hex value (prefixed with `0x` or `$`) or a binary value (prefixed with `0b` or `%`).

## Export Tool

A binary version of the export feature is attached to this project in the releases section. You can use
this to turn saved txt file exports into whatever format in your build process.

Use it by downloading the binary for your platform, then on the command line, do:

```
./ascii2retro [output type] [path/to/input-file.txt] [path/to/save/to]
```

Example:

```
 ./ascii2retro json myfile.txt myfile.json
```

Note macos binaries are untested and experimental! Create a bug with detail if you need help with them.

## License

MIT License! Do what you want with this. And if you find this useful or make something cool, let me know! Knowing people
use my tools is what keeps me making them, and I don't hear as much as you might think.
