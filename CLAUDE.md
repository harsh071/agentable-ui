## Where this repo fits

Four pieces, one story: build with Agentable → generate in Studio → prove it works with RUI → publish on the lab.

- **Interfaces for Humans**: the open lab and brand. https://www.interfacesforhuman.com (repo `rui-home`)
- **RUI**: the product. Checks what a generated interface actually does, in a real browser. Engine, SDK and the dashboard (`apps/eval`) live in repo `rui`. https://rui.interfacesforhuman.com
- **Agentable UI**: open-source React components that people and AI agents can both use (npm `@agentable-ui/*`). Repo `agentable-ui`. https://agentable.interfacesforhuman.com
- **Agentable Studio**: the demo generator; builds Agentable apps and sends runs to RUI. Repo `agentable-studio`. https://studio.interfacesforhuman.com. Never call it "rui studio".
- `rui-video`: Remotion scenes for launch films.

This repo is: **Agentable UI**.
Plan: https://claude.ai/code/artifact/b9cff975-edf3-438d-b19e-ed5ff09eb414

Agentable stays a pure component library: no evals, model calls or API-key dependencies here. Those belong in RUI or Studio.
