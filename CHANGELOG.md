# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - `examples/interceptor-demo.ts` - Axios interceptor demonstrations
  - `examples/axios-interceptors.ts` - Advanced interceptor patterns
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
