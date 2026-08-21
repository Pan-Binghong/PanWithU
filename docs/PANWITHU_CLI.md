# PanwithU CLI

> Learn English. Grow together.

PanwithU is a local-first English learning companion built for the terminal.
Practice vocabulary, earn stars, and grow an animated pet that remembers the
journey with you.

## Install

PanwithU requires Node.js 22.19 or newer.

```bash
npm install -g panwithu@latest
pwu
```

The full-name command `panwithu` is also available. On case-insensitive systems
such as Windows and default macOS installations, `PWU` resolves to the same
command. Linux users who prefer uppercase can add this alias to their shell
configuration:

```bash
alias PWU=pwu
```

To try PanwithU without a global installation, run:

```bash
npx --yes panwithu@latest
```

### macOS: fix `EACCES` without `sudo`

If npm tries to install into `/usr/local/lib/node_modules` and reports
`permission denied`, move npm's global packages into your user directory:

```bash
npm config set prefix "$HOME/.local"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
source "$HOME/.zshrc"
npm install -g panwithu@latest
pwu
```

Use `panwithu@latest`, with an `@`. `panwithu:latest` is an unsupported URL,
and `npx install panwithu` attempts to run an unrelated package named
`install`.

## First start

The terminal guides you through four short steps:

1. Choose Simplified Chinese or English.
2. Choose American or British English pronunciation.
3. Enter an invitation code, or leave it empty for offline mode.
4. Choose one of 25 animated pets.

## Commands

```text
pwu learn [count]  Practice English words
pwu pet            Visit your companion
pwu feed           Feed your companion
pwu play           Play together
pwu todo           View the learning plan
pwu todo add TEXT  Add a personal task
pwu todo done N    Complete a task
pwu reminder install [hour]
                   Enable the daily system reminder (default: 19:00)
pwu reminder remove
                   Disable the daily system reminder
pwu summary        Get a personal learning summary
pwu status         Show progress
pwu config         Run setup again
```

Running `pwu` without a command opens the interactive terminal UI. Inside the
UI, `/coach` asks the pet for personalized learning advice, and `/color`
changes the saved terminal theme.

## Local data

PanwithU has no account system. Configuration and learning history stay on the
current computer:

```text
~/.config/panwithu/config.json
~/.local/share/panwithu/profile.json
~/.local/share/panwithu/audio/
```

Pronunciation resolves in this order: dictionary pronunciation, local cache,
generated speech, then the operating-system voice. Failed and due words are
selected before new words.

## Development

```bash
yarn install
yarn cli
yarn test:cli
yarn lint
yarn build
```

PanwithU embeds the
[Pi coding agent SDK](https://github.com/earendil-works/pi) as its agent
harness. Intelligent summaries use a fixed model, and generated pronunciation
uses an OpenAI-compatible speech endpoint. Provider configuration stays
internal to the CLI.
