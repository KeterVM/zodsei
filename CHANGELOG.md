# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-10-30

### Changed

- Removed duplicate client config fields in favor of Axios instance configuration:
  - Removed `baseUrl`, `headers`, `timeout`, `retries` from client config.
  - Client now builds URLs using `axiosInstance.defaults.baseURL` (relative paths if absent).
  - Default headers should be set on the Axios instance or via middleware.

### Migration

- Use Axios instance for connection concerns:
  - Base URL: `axios.create({ baseURL: 'https://api.example.com' })`
  - Headers: `axios.defaults.headers.common.Authorization = 'Bearer ...'` (or an auth middleware)
  - Timeout: `axios.create({ timeout: 10_000 })`
  - Retries: configure via `retryMiddleware({ retries: ... })`

### Internal

- Updated types and client implementation to drop now-redundant fields.
- Updated examples/tests/README to reflect Axios-only + instance-driven configuration.

## [1.0.0] - 2025-10-29

### Breaking

- Adapter system simplified to Axios-only. Removed fetch/ky adapters and the adapter factory.
  - Removed exports: `createAdapter`, `isAdapterAvailable`, `getDefaultAdapter`, `FetchAdapter`, `KyAdapter`.
  - Client config no longer supports `adapter`/`adapterConfig`.
  - You must now inject your own Axios instance: `createClient(contract, { baseUrl, axios })`.

### Changed

- Client config switches to Axios instance injection (`AxiosInstance`); the client internally uses Axios.
- README and README.zh-CN updated for Axios-only usage. Installation now lists `axios`. All examples call `createClient` with an Axios instance.
- Tests and examples migrated to Axios injection; removed multi-adapter examples/tests.
- Stricter ESLint: forbid explicit `any` in src; enable deprecated API checks for typed targets; disable typed rules for non-typed groups (examples/config/js) to avoid parserServices errors.
- Zod v4 API usage unified: `z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`.
- Types refined: replace `ZodSchema`/`ZodTypeAny` with `z.ZodType`; remove `any` in src in favor of `unknown` and precise types (adapters/client/utils).

### Removed

- Deleted files:
  - `src/adapters/fetch.ts`
  - `src/adapters/ky.ts`
  - `tests/adapters.test.ts`
  - `examples/adapter-usage.ts`
  - `examples/type-safe-config.ts`

### Migration

- Creating a client:
  - Before:

    ```ts
    const client = createClient(contract, { baseUrl, adapter: 'fetch', adapterConfig: { timeout: 10_000 } });
    ```

  - Now:

    ```ts
    import axios from 'axios';
    const axiosInstance = axios.create({ baseURL: baseUrl, timeout: 10_000 });
    const client = createClient(contract, { baseUrl, axios: axiosInstance });
    ```

- Adapter-related exports/types were removed; replace usage with Axios instance injection.
- Zod API mapping: `z.string().uuid()`/`z.string().email()`/`z.string().url()`/`z.string().datetime()` → `z.uuid()`/`z.email()`/`z.url()`/`z.iso.datetime()`.
- Tests: mock Axios `request` instead of `fetch`.

### Internal

- `src/validation.ts`, `src/types.ts`, `src/schema.ts` now use `z.ZodType` uniformly.
- ESLint flat config:
  - src/tests (typed): enable `@typescript-eslint/no-deprecated: error`, forbid explicit `any`.
  - examples/config/js (non-typed): disable typed rules that require parserServices.
- All tests pass (72/72).

## [0.5.1] - 2025-08-13

### Fixed

- **Optional Schemas HTTP Request Testing**: Added comprehensive HTTP request tests for optional schemas functionality
  - Fixed `separateParams` utility to handle `null`/`undefined` data for endpoints without request schemas
  - Added proper test coverage for all optional schema scenarios: endpoints with/without request/response schemas
  - Improved test reliability using mock fetch patterns consistent with existing test suite
- **Path Parameter Handling**: Corrected DELETE request handling to properly extract path parameters from URL instead of request body

### Tests

- **Enhanced Test Coverage**: Added complete HTTP request testing for optional schemas feature
  - Tests for endpoints with request schema validation (`createUser`)
  - Tests for endpoints without request schema (`getUsers`, `healthCheck`)
  - Tests for endpoints with only request schema (`deleteUser`)
  - Tests for request/response validation behavior with optional schemas
  - Tests for proper path parameter extraction and URL construction

### Technical

- **`separateParams` Utility**: Enhanced to handle `null`/`undefined` input data gracefully
- **Test Infrastructure**: Improved mock fetch setup following project testing patterns

## [0.5.0] - 2025-08-13

### Added

- Full support for optional request and response schemas in endpoint definitions.
- Runtime type info flags: `hasRequestSchema` and `hasResponseSchema` via `extractTypeInfo()`.

### Changed

- Endpoint method signatures now conditionally require parameters only when a request schema exists.
- Validation utilities (`validateRequest`, `validateResponse`, `safeParseRequest`, `safeParseResponse`) gracefully skip validation when schemas are undefined.
- Type inference helpers (`InferRequestType`, `InferResponseType`) now conditionally infer `void`/`unknown` when schemas are missing.
- `.infer` property on endpoint methods now reflects schema presence (e.g., `infer.request` is `{}` or `undefined` when no request schema).

### Fixed

- Client endpoint detection no longer requires `request`/`response` to exist for a valid endpoint.

### Docs

- New examples demonstrating endpoints with optional request/response schemas.
- Updated schema extraction and description docs to handle optional schemas.

### Migration

- Existing endpoints remain compatible without changes.
- For endpoints without a request schema, calling methods without arguments is now the canonical form. Passing `undefined` still works but is unnecessary.
- If you previously assumed `.infer.request` always exists, update code to handle the optional shape.

## [0.4.0] - 2025-07-28

### 🚀 Major Features

- **Schema Inference and Type Extraction** - Revolutionary runtime schema access and type inference system
  - **Automatic Type Inference**: Endpoint methods now automatically infer request and response types
  - **Schema Access**: Every endpoint method includes `.schema` property with complete schema information
  - **Type Inference Helpers**: Added `.infer` property for compile-time type extraction
  - **Schema Extractor**: Powerful `$schema` property for advanced schema operations
  - **Nested Contract Support**: Full schema access support for nested contract structures

### ✨ New APIs

- **Enhanced Endpoint Methods**: All endpoint methods now include schema metadata

  ```typescript
  client.getUser.schema.request   // Zod request schema
  client.getUser.schema.response  // Zod response schema
  client.getUser.schema.endpoint  // Complete endpoint definition
  ```

- **Type Inference Helpers**: Compile-time type extraction utilities

  ```typescript
  type RequestType = typeof client.getUser.infer.request;
  type ResponseType = typeof client.getUser.infer.response;
  ```

- **Schema Extractor**: Advanced schema introspection and manipulation

  ```typescript
  const schema = client.$schema;
  schema.getEndpointPaths();           // ['getUser', 'createUser', ...]
  schema.getEndpointSchemas('getUser'); // Complete schema info
  schema.describeEndpoint('getUser');   // Documentation-friendly description
  ```

### 🎯 Enhanced Developer Experience

- **Runtime Schema Access**: Access Zod schemas at runtime for validation, documentation generation, and testing
- **Type-Safe Development**: Complete TypeScript type inference from schema definitions
- **Documentation Generation**: Built-in schema description utilities for API documentation
- **Testing Support**: Easy access to schemas for mock data generation and validation testing

### 🔧 API Improvements

- **Simplified API Design**: Unified `ApiClient<T>` type now includes all schema functionality by default
- **Removed Legacy APIs**: Eliminated `createLegacyClient` for cleaner, more focused API surface
- **Enhanced Type System**: `EndpointMethodWithSchema<T>` provides rich method signatures with metadata

### 📚 New Utilities

- **`InferRequestType<T>`** and **`InferResponseType<T>`**: Extract types from endpoint definitions
- **`InferContractTypes<T>`**: Extract all types from entire contract definitions
- **`SchemaExtractor<T>`**: Powerful class for schema introspection and manipulation
- **`extractTypeInfo()`**: Utility function for runtime type information extraction

### 🏗️ Technical Implementation

- **Advanced TypeScript Generics**: Sophisticated conditional types for schema inference
- **Runtime Type Safety**: Zod schema integration with TypeScript type system
- **Proxy-Based Enhancement**: Dynamic method enhancement with schema metadata
- **Zero Runtime Overhead**: Type inference happens at compile-time with minimal runtime impact

### 📖 Examples and Documentation

- **`examples/schema-inference.ts`**: Comprehensive demonstration of all new features
- **`examples/simple-test.ts`**: Quick start guide for schema functionality
- **Enhanced inline documentation**: Detailed JSDoc comments for all new APIs

### Usage Examples

```typescript
// Create client with enhanced schema support
const client = createClient(contract, config);

// 1. Automatic type inference
const user = await client.getUser({ id: '123' });
// user is automatically typed as z.infer<typeof contract.getUser.response>

// 2. Schema access
console.log(client.getUser.schema.request);   // Zod schema object
console.log(client.getUser.schema.response);  // Zod schema object

// 3. Type inference helpers
type GetUserRequest = typeof client.getUser.infer.request;
type GetUserResponse = typeof client.getUser.infer.response;

// 4. Schema extractor for advanced operations
const schema = client.$schema;
const endpoints = schema.getEndpointPaths();
const description = schema.describeEndpoint('getUser');

// 5. Nested contract support
await client.profile.update({ name: 'New Name' });
console.log(client.profile.update.schema.request);
```

### 🔄 Migration Guide

This release is **fully backward compatible**. Existing code will continue to work without changes, but you can now access additional schema functionality:

```typescript
// Before: Basic usage (still works)
const result = await client.getUser({ id: '123' });

// After: Enhanced with schema access (new capability)
const result = await client.getUser({ id: '123' });
const requestSchema = client.getUser.schema.request;
const responseSchema = client.getUser.schema.response;
```

## [0.3.0] - 2025-07-28

### ✨ Added

- **Type-Safe Adapter Configuration** - Revolutionary conditional type system for adapter configurations
  - `adapterConfig` type is now automatically inferred based on the `adapter` parameter
  - When `adapter: 'fetch'`, `adapterConfig` is typed as `FetchAdapterConfig`
  - When `adapter: 'axios'`, `adapterConfig` is typed as `AxiosAdapterConfig`
  - When `adapter: 'ky'`, `adapterConfig` is typed as `KyAdapterConfig`
  - TypeScript provides intelligent autocomplete and compile-time validation
  - Prevents configuration errors by catching invalid options at build time

- **Enhanced Developer Experience**
  - Smart IntelliSense for adapter-specific configuration options
  - Compile-time error detection for invalid adapter configurations
  - Comprehensive examples demonstrating type-safe configuration patterns

### 🔧 Improved

- **Modern ESLint Configuration**
  - Migrated from legacy `.eslintrc.js` to modern flat config (`eslint.config.mjs`)
  - Added TypeScript-specific rules with proper ignore patterns
  - Configured separate rules for examples and test files
  - Enhanced code quality and consistency across the project

- **Type System Enhancements**
  - Added `InternalClientConfig` type for better internal type handling
  - Improved adapter configuration type definitions
  - Enhanced type safety without breaking backward compatibility

- **Code Quality**
  - Fixed various lint issues and type safety problems
  - Improved adapter factory function flexibility
  - Clean up unused imports and consistent code formatting
  - Better error handling in adapter implementations

### 📚 Documentation

- **Updated README** with type-safe configuration examples
- **Added comprehensive examples** in `examples/type-safe-config.ts`
- **Enhanced inline documentation** with better type annotations

### 🏗️ Technical Details

- **Conditional Union Types** - Implemented sophisticated TypeScript conditional types for adapter configuration
- **Backward Compatibility** - All changes maintain 100% backward compatibility
- **Type Inference** - Enhanced TypeScript's ability to infer correct types based on runtime values

### Usage Example

```typescript
// ✅ Type-safe fetch configuration
const fetchClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'fetch', // 👈 This determines adapterConfig type
  adapterConfig: {
    credentials: 'include', // ✅ Valid for fetch
    mode: 'cors',           // ✅ Valid for fetch
    // auth: { username: 'user' } // ❌ TypeScript error: not valid for fetch
  }
});

// ✅ Type-safe axios configuration
const axiosClient = createClient(contract, {
  baseUrl: 'https://api.example.com',
  adapter: 'axios', // 👈 This determines adapterConfig type
  adapterConfig: {
    auth: { username: 'user', password: 'pass' }, // ✅ Valid for axios
    maxRedirects: 5,                               // ✅ Valid for axios
    // credentials: 'include' // ❌ TypeScript error: not valid for axios
  }
});
```

## [0.2.1-alpha] - 2025-07-28

### Added

- **Nested Contract Support** - Contracts can now be nested to organize API endpoints by feature or module
  - Use `defineContract()` within other contracts to create hierarchical structures
  - Access nested endpoints with dot notation: `client.auth.login()`, `client.users.create()`
  - Maintains full type safety and IntelliSense support for nested structures
  - Added comprehensive example in `examples/nested-contract.ts`

### Enhanced

- **Type System Improvements** - Enhanced `Contract` interface to support nested structures
- **Client Implementation** - Updated Proxy-based client to handle nested contract navigation
- **Documentation** - Added nested contract examples to README.md

### Technical Details

- Modified `Contract` type from `Record<string, EndpointDefinition>` to `interface Contract { [key: string]: EndpointDefinition | Contract }`
- Enhanced `ApiClient<T>` type to support recursive nested structures
- Implemented `createNestedClient()` method for handling sub-contracts
- Added type guards `isEndpointDefinition()` and `isNestedContract()` for runtime detection

### Usage Example

```typescript
const contract = defineContract({
  auth: defineContract({
    login: {
      path: '/auth/login',
      method: 'post',
      request: z.object({ email: z.string(), password: z.string() }),
      response: z.object({ token: z.string() })
    }
  }),
  users: defineContract({
    getById: {
      path: '/users/:id',
      method: 'get',
      request: z.object({ id: z.string() }),
      response: UserSchema
    }
  })
});

// Usage with nested structure
const loginResult = await client.auth.login({ email, password });
const user = await client.users.getById({ id: '123' });
```

## [0.2.0-alpha] - 2025-07-28

### Added

- **defineContract helper function** - New utility for defining contracts with better type inference
- **Comprehensive examples** - Added multiple example files demonstrating different use cases:
  - `examples/basic-usage.ts` - Basic client usage with middleware
  - `examples/adapter-usage.ts` - HTTP adapter comparison and configuration
  - `examples/interceptor-demo.ts` - Middleware demonstrations (auth, logging, error handling)
  - `examples/contract-definition-comparison.ts` - Different contract definition approaches

### Changed

- **BREAKING: Updated Zod dependency** - Upgraded to Zod v4 with improved API and performance
- **Improved contract definition syntax** - All examples now use `defineContract()` for better developer experience
- **Updated ESLint configuration** - Migrated from `.eslintrc.js` to modern flat config format (`eslint.config.js`)
- **Optimized bundle size** - Reduced package size by 94% (from ~500KB to ~30KB) by properly externalizing dependencies

### Fixed

- **Bundle optimization** - Zod is now correctly treated as external dependency instead of being bundled
- **Dependency management** - Moved Zod from `dependencies` to `peerDependencies` for better version control
- **Type safety improvements** - Enhanced type inference with `defineContract` helper

### Technical Improvements

- **Updated all dependencies** to latest versions
- **Enhanced test coverage** - Added comprehensive middleware and adapter tests
- **Improved documentation** - Updated README with consistent examples using `defineContract`
- **Better TypeScript support** - Enhanced type definitions and inference

### Migration Guide

#### Contract Definition

```typescript
// Old way (still works but not recommended)
const contract = {
  getUser: { ... }
} as const satisfies Contract;

// New way (recommended)
import { defineContract } from 'zodsei';
const contract = defineContract({
  getUser: { ... }
});
```

#### Zod Schema Updates

```typescript
// Old (deprecated in Zod v4)
z.string().uuid()
z.string().email()
z.string().datetime()

// New (Zod v4 recommended)
z.uuidv4()
z.email()
z.iso.datetime()
```

## [0.1.4] - 2025-07-27

### Initial Release

- Contract-first HTTP client with Zod validation
- Support for multiple HTTP adapters (Fetch, Axios, Ky)
- Middleware system (retry, cache)
- Full TypeScript support
- Comprehensive test suite
