<div align="center">

<h1 align="center">Karina VSCode Extension</h1>
<a href="https://karina-lang.org/">
  karina-lang.org
</a>

</div>

<br>
<br>

![Test Status](https://github.com/Plixo2/Karina-VSCode/actions/workflows/publish_marketplace.yml/badge.svg)
![Java Version](https://img.shields.io/badge/Java-23+-orange)
![Karina Version](https://img.shields.io/badge/Karina-v0.7-8A2BE2)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0)
<br>

## Requirements

- Java 23+

## Features

- Syntax highlighting for Karina files
- Command for running Karina code directly from VSCode
- Error and warning diagnostics for Karina files
- Qick fixes for imports and types
- Completion suggestions
- Document Symbols and Outline view


## Setup


- Install the extension from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=karina.karina-lsp) or search for "Karina" in the extensions tab of VSCode.
- Download the [Karina Language Server](https://github.com/Plixo2/KarinaC/releases/latest/download/karina-lsp.jar) and configure the path in the extension settings (`karina.lspLocation`).

- Create a new folder called `src` in your workspace and create a `main.krna` file in it with the following content:
  ```karina
  pub fn main(args: [string]) {
      println("Hello, World!")
  }
  ```
- Create a `karina-build.json` file in the root of your workspace with the following content:
  ```json
  {
    "source": "src"
  }
  ```
- Set a Keybind for the `karina.run.main` command or use the command palette to run.

