# Development Workflow

This document outlines the workflow for modifying, building, and using the forked TinaCMS package (`cg-forged-tina`) in your projects.

## Project Structure

- **`cg-forged-tina`**: The forked TinaCMS monorepo containing the source code.
- **`cg-tina-template`**: The project that CONSUMES the modified TinaCMS package.

## Important Files

### Branding & UI
- **Logo/Icon**: `packages/tinacms/src/toolkit/icons/Tina.tsx`
  - *Current Change*: Replaced Tina SVG with "CG" text.
- **Branding Text**: 
  - `packages/tinacms/src/auth/TinaCloudProvider.tsx` (Login modal text)
  - `packages/tinacms/src/tina-cms.tsx` (Error headers)
  - *Current Change*: Replaced "TinaCMS" with "CG-CMS".

### Admin UI Customizations
- **Chatbot**:
  - Component: `packages/tinacms/src/admin/components/Chatbot.tsx`
  - Integration: `packages/tinacms/src/admin/components/Layout.tsx`
- **Version Label**: `packages/tinacms/src/toolkit/react-sidebar/components/VersionInfo.tsx`
- **Post Field Hints**: `packages/tinacms/src/toolkit/fields/plugins/wrap-field-with-meta.tsx`

### AI Chatbot
- **Component**: `packages/tinacms/src/admin/components/Chatbot.tsx`
  - Contains the UI for the floating chatbot button and window.
- **Integration**: `packages/tinacms/src/admin/components/Layout.tsx`
  - The `Chatbot` component is imported and rendered here to ensure it appears on all admin pages.

## Step-by-Step Guide

### 1. Setup
Ensure dependencies are installed in the monorepo root:
```bash
# In /Users/almazkhalilov/Documents/Tina-v3/cg-forged-tina
pnpm install
```

### 2. Make Changes
Modify the source code in `packages/tinacms/src/...`. 
For example, to change the chatbot color, edit `packages/tinacms/src/admin/components/Chatbot.tsx`.

### 3. Build the Package
Use `turbo` to build the `tinacms` package and its dependencies:
```bash
# In /Users/almazkhalilov/Documents/Tina-v3/cg-forged-tina
pnpm exec turbo run build --filter=tinacms
```

### 3b. Fast Local Iteration (Preferred)
Skip repacking by linking the local package and running the watcher:

```bash
# In /Users/almazkhalilov/Documents/Tina-v3/cg-tina-template
pnpm add tinacms@link:../cg-forged-tina/packages/tinacms
```

```bash
# In /Users/almazkhalilov/Documents/Tina-v3/cg-forged-tina
pnpm --filter @tinacms/scripts run watch
```

If you link CLI/metrics and they are missing `dist/`, build them once:
```bash
pnpm --filter @tinacms/cli run build
pnpm --filter @tinacms/metrics run build
```

In the template, keep `pnpm dev` running and refresh the admin UI.

### 4. Pack the Package
Create a tarball (`.tgz`) from the built package. This mimics publishing to npm but keeps it local.
```bash
cd packages/tinacms
pnpm pack
```
*Note the output filename (e.g., `tinacms-3.2.1.tgz`).*

### Fast Repack
To speed up the process, you can use the `repack.sh` script in the root of `cg-forged-tina`:

```bash
./repack.sh
```

This script will:
1. Build the `tinacms` package.
2. Pack it into a tarball.
3. Automatically run `pnpm install` in `cg-tina-template`.

### 5. Link in Your Project
Update your project's `package.json` (e.g., in `cg-tina-template`) to point to the new tarball file.

```json
"dependencies": {
  "tinacms": "file:../cg-forged-tina/packages/tinacms/tinacms-3.2.1.tgz"
}
```

If you are using local links, keep `next dev` (no Turbopack) to avoid module resolution issues:
```json
"dev": "tinacms dev -c \"next dev\""
```

### 6. Apply Changes
Install the new dependency in your project and restart the dev server:

```bash
# In /Users/almazkhalilov/Documents/Tina-v3/cg-tina-template
pnpm install
pnpm dev
```

## Troubleshooting
- **Chatbot not showing?** 
  - Ensure you rebuilt the package (`Step 3`) and repacked it (`Step 4`).
  - Ensure you ran `pnpm install` in the template (`Step 6`).
  - Try clearing `node_modules` in `cg-tina-template` if changes stick.
- **"Port usage" error?**
  - Use `lsof -ti:PORT | xargs kill -9` to free up the port.
- **Module not found (tinacms/dist/...)**:
  - Make sure local links are installed and `pnpm --filter tinacms run build` has been run.
  - Ensure `next dev` (no Turbopack) is used when working with linked packages.
- **ENOSPC (no space left on device)**:
  - Remove `cg-tina-template/.next` and prune the pnpm store: `pnpm store prune`.
