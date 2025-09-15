<div align="center">

<h1 align="center">Karina VSCode Extension</h1>
<a href="https://karina-lang.org/">
  karina-lang.org
</a>

</div>

<br>

## Features

- Syntax highlighting for Karina files
- Command for running Karina code directly from VSCode
- Error and warning diagnostics for Karina files
- Qick fixes for imports and types
- Completion suggestions
- Document Symbols and Outline view


## Setup

- Install the extension from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=karina.karina-lsp).
- Download the [Karina Language Server](https://github.com/Plixo2/KarinaC/releases/latest/download/karina-lsp.jar) and configure the path in the extension settings (`karina.lspLocation`).
- Create a `karina-build.json` file in the root of your workspace. Example:
  ```json
  {
    "source": "src"
  }
  ```
- Set a Keybind for the `karina.run.main` command or use the command palette to run the main function of your project.
