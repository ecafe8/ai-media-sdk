# workspace-test-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Examples workspace pattern is registered
The root Bun workspace configuration SHALL include `examples/*` while Phase 0 SHALL leave live example implementations for a later phase.

#### Scenario: Workspace installation recognizes future examples
- **WHEN** `bun install` evaluates the root workspace configuration
- **THEN** packages placed directly under `examples/` SHALL be eligible workspace members

#### Scenario: Phase 0 performs no live example request
- **WHEN** Phase 0 verification runs
- **THEN** no example SHALL require Provider credentials or perform an external API call

### Requirement: Test execution is orchestrated by Bun and Turbo
The root package SHALL expose `bun run test` through a Turborepo `test` task, and test-bearing packages SHALL expose a `test` script that invokes Bun's test runner.

#### Scenario: Root test command delegates to workspace tests
- **WHEN** a developer runs `bun run test`
- **THEN** Turbo SHALL discover and execute the `test` scripts of eligible workspace packages

#### Scenario: Test typechecking uses isolated Bun types
- **WHEN** a package typecheck includes test files
- **THEN** its test tsconfig SHALL include `types: ["node", "bun"]` separately from the runtime tsconfig

### Requirement: Test-bearing packages own Bun type dependencies
Each package containing `bun:test` files SHALL declare `@types/bun` in its own development dependencies rather than relying on root dependency hoisting.

#### Scenario: Test package resolves Bun module types independently
- **WHEN** a test-bearing package is typechecked from its own workspace
- **THEN** `bun:test` types SHALL resolve from that package's declared development dependencies

### Requirement: Phase 0 verification is network-independent
The Phase 0 test and typecheck baseline SHALL pass without Azure credentials, Alibaba credentials, Provider endpoints, or external network access.

#### Scenario: Clean local verification
- **WHEN** a developer runs install, lint, typecheck, and test with no Provider environment variables
- **THEN** the Phase 0 workspaces SHALL complete successfully using only local source and smoke tests

### Requirement: Formatting is verified for Phase 0 files
The Phase 0 verification process SHALL include a non-mutating formatting check for all new and changed files.

#### Scenario: Formatting check passes
- **WHEN** the Phase 0 format verification runs
- **THEN** Prettier SHALL report no formatting differences without modifying files

