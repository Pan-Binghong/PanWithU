# PanWithU CLI

> Learn English. Grow together.

PanWithU is a local-first English learning companion built for the terminal.
Practice vocabulary, earn stars, and grow an animated pet that remembers the
journey with you.

## Install

PanWithU requires Node.js 22.19 or newer.

```bash
npm install -g panwithu@latest
PWU
```

The lowercase command is also available: `panwithu`. To try it without a
global installation, run:

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
PWU
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
PWU learn [count]  Practice English words
PWU pet            Visit your companion
PWU feed           Feed your companion
PWU play           Play together
PWU todo           View the learning plan
PWU todo add TEXT  Add a personal task
PWU todo done N    Complete a task
PWU reminder install [hour]
                   Enable the daily system reminder (default: 19:00)
PWU reminder remove
                   Disable the daily system reminder
PWU summary        Get a personal learning summary
PWU status         Show progress
PWU config         Run setup again
```

Running `PWU` without a command opens the interactive terminal UI. Inside the
UI, `/coach` asks the pet for personalized learning advice, and `/color`
changes the saved terminal theme.

## Local data

PanWithU has no account system. Configuration and learning history stay on the
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

PanWithU embeds the
[Pi coding agent SDK](https://github.com/earendil-works/pi) as its agent
harness. Intelligent summaries use a fixed model, and generated pronunciation
uses an OpenAI-compatible speech endpoint. Provider configuration stays
internal to the CLI.
