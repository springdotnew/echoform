# TypeScript Frontend Best Practices

## Golden Rules

1. **Never write comments that can be understood by reading code** - Comments should only explain "why", never "what"
2. **Never nest if statements** - Split logic into multiple functions when needed

## Core Principles

### 1. Zero Mutation

- Avoid modifying existing variables or objects
- Use immutable patterns and create new instances instead
- Benefits:
  - Predictable state management
  - Easier debugging
  - Better concurrency handling
  - Clearer data flow

Example:

```typescript
// ❌ Avoid
let user = { name: "John", age: 30 };
user.age = 31;

// ✅ Prefer
const user = { name: "John", age: 30 };
const updatedUser = { ...user, age: 31 };
```

### 2. Zero Nested If Statements

- **Never nest if statements** - split to multiple functions when needed
- Flatten conditional logic using early returns
- Use guard clauses
- Extract complex conditions into well-named business logic functions
- Benefits:
  - Improved readability
  - Reduced cognitive load
  - Easier testing
  - Better maintainability

Example:

```typescript
// ❌ Avoid
function processUser(user: User) {
  if (user.isActive) {
    if (user.hasPermission) {
      if (user.isAdmin) {
        // do something
      }
    }
  }
}

// ✅ Prefer
function processUser(user: User) {
  if (!isActiveUser(user)) return;
  if (!hasRequiredPermissions(user)) return;
  if (!isAdminUser(user)) return;

  // do something
}

function isActiveUser(user: User): boolean {
  return user.isActive;
}

function hasRequiredPermissions(user: User): boolean {
  return user.hasPermission;
}

function isAdminUser(user: User): boolean {
  return user.isAdmin;
}
```

```typescript-react
// ❌ Avoid
const { data, isLoading, error } = useQuery({
  queryKey: ["user", userId],
  queryFn: () => getUser(userId),
});
const [userFormData, setUserFormData] = useState<Partial<User>>({});
useEffect(() => {
  setUserFormData(data);
}, [data]);

// ✅ Prefer
const { data: userData, isLoading: isLoadingUser, error: userError } = useQuery({
  queryKey: ["user", userId],
  queryFn: () => getUser(userId),
});
const [userFormData, setUserFormData] = useState<Partial<User>>({});
const userFormDataWithDefaults = useMemo(() => ({
  ...userData,
  ...userFormData,
}), [userFormData, userData]);

```

### 3. Descriptive Variables

- Use clear, meaningful names
- Avoid abbreviations
- Include type information in names when helpful
- Benefits:
  - Self-documenting code
  - Easier understanding
  - Reduced need for comments

Example:

```typescript
// ❌ Avoid
const user = getUser();
const d = new Date();
const subscriptions = [];

// ✅ Prefer
const billedUser = getUser();
const currentTimestamp = new Date();
const activeUserSubscriptions = [];
```

### 4. Strict Interfaces

- Define explicit interfaces for all data structures
- Avoid using `any` type
- Use union types for specific alternatives
- Benefits:
  - Type safety
  - Better IDE support
  - Clearer contracts
  - Easier refactoring

Example:

```typescript
// ❌ Avoid
function processData(data: any) {
  // ...
}

// ✅ Prefer
interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

function processData(data: UserData) {
  // ...
}
```

### 5. Make Illegal States Impossible to Represent

- Design types so that invalid states cannot be expressed
- Use discriminated unions to model mutually exclusive states
- Prefer separate type definitions for readability over inline intersections
- Leverage the type system to enforce business rules at compile time
- Benefits:
  - Eliminates entire categories of bugs
  - No runtime checks needed for impossible states
  - Self-documenting domain constraints
  - Compiler catches invalid state transitions

Example:

```typescript
// ❌ Avoid - allows illegal states
interface User {
  id: string;
  email: string;
  isVerified: boolean;
  verifiedAt: Date | null; // Can be null when isVerified is true!
  password: string | null;
  oauthProvider: string | null; // Both can be set or both null
}

// ✅ Prefer - illegal states are impossible to represent
type UnverifiedUser = {
  id: string;
  email: string;
  verificationStatus: "unverified";
};

type VerifiedUser = {
  id: string;
  email: string;
  verificationStatus: "verified";
  verifiedAt: Date;
};

type PasswordAuth = {
  authMethod: "password";
  passwordHash: string;
};

type OAuthAuth = {
  authMethod: "oauth";
  provider: "google" | "github";
  oauthId: string;
};

type User = (UnverifiedUser | VerifiedUser) & (PasswordAuth | OAuthAuth);

// ❌ Avoid - allows invalid order states
interface Order {
  id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
}

// ✅ Prefer - each state only has relevant fields
type OrderBase = {
  id: string;
  items: OrderItem[];
};

type PendingOrder = OrderBase & {
  status: "pending";
};

type ShippedOrder = OrderBase & {
  status: "shipped";
  shippedAt: Date;
  trackingNumber: string;
};

type DeliveredOrder = OrderBase & {
  status: "delivered";
  shippedAt: Date;
  deliveredAt: Date;
};

type CancelledOrder = OrderBase & {
  status: "cancelled";
  cancelledAt: Date;
  reason: string;
};

type Order = PendingOrder | ShippedOrder | DeliveredOrder | CancelledOrder;

// Now the compiler prevents impossible states:
function processOrder(order: Order) {
  if (order.status === "delivered") {
    // TypeScript knows deliveredAt exists here
    console.log(`Delivered at: ${order.deliveredAt}`);
  }

  if (order.status === "pending") {
    // TypeScript error: Property 'shippedAt' does not exist
    // console.log(order.shippedAt);
  }
}
```

### 6. Type-Based Handlers

- Use discriminated unions for multiple types
- Implement separate handlers for each type
- Benefits:
  - Type safety
  - Clear handling logic
  - Exhaustive type checking

Example:

```typescript
type SuccessResult = { type: "success"; data: UserData };
type ErrorResult = { type: "error"; error: Error };
type LoadingResult = { type: "loading" };

type Result = SuccessResult | ErrorResult | LoadingResult;

function handleResult(result: Result) {
  switch (result.type) {
    case "success":
      return processSuccess(result.data);
    case "error":
      return handleError(result.error);
    case "loading":
      return showLoadingState();
  }
}
```

### 7. Reuse existing types and functions

- Leverage existing types and functions when possible
- Infer types from existing codebase references when strict types are not defined
- Example:

  ```typescript
  // ❌ Avoid
  import { getUser } from "./user";
  interface User {
    id: string;
    name: string;
    email: string;
  }

  // ✅ Prefer
  import { getUser } from "./user";
  type User = ReturnType<typeof getUser>;
  ```

- Request code references from users if are unable to find them

### 8. Extract Business Logic into Named Functions

- Wrap conditional checks in descriptive functions when they represent business rules
- Makes code self-documenting and easier to test
- Benefits:
  - Clear intent at the call site
  - Reusable business logic
  - Easier to modify rules in one place

Example:

```typescript
// ❌ Avoid - business logic hidden in conditionals
function applyDiscount(user: User, price: number): number {
  if (!user.subscription) {
    return price;
  }
  if (user.subscription.type === "premium" && user.subscription.isActive) {
    return price * 0.8;
  }
  return price;
}

// ✅ Prefer - business logic is explicit and named
function hasPremiumSubscription(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.type === "premium" && subscription.isActive;
}

function applyDiscount(user: User, price: number): number {
  if (!hasPremiumSubscription(user.subscription)) {
    return price;
  }
  return price * 0.8;
}
```

### 9. Functional Programming - Never Use Classes

- **Never use classes** - use functions and plain objects instead
- Use closures for encapsulation when needed
- Prefer composition over inheritance
- Benefits:
  - Simpler mental model
  - Better tree-shaking
  - Easier testing
  - More predictable behavior

Example:

```typescript
// ❌ Avoid - classes
class UserService {
  constructor(private database: Database) {}

  getUser(id: string): User {
    return this.database.findUser(id);
  }

  saveUser(user: User): void {
    this.database.save(user);
  }
}

// ✅ Prefer - functions with dependency injection
type UserRepository = {
  findUser: (id: string) => User;
  save: (user: User) => void;
};

function createUserService(repository: UserRepository) {
  return {
    getUser: (id: string): User => repository.findUser(id),
    saveUser: (user: User): void => repository.save(user),
  };
}

// Or simply export standalone functions
function getUser(repository: UserRepository, id: string): User {
  return repository.findUser(id);
}

function saveUser(repository: UserRepository, user: User): void {
  repository.save(user);
}
```

## Clean Code Principles (Functional Approach)

### 1. Meaningful Names

- Use intention-revealing names
- Avoid mental mapping
- Use searchable names
- Module/namespace names should be nouns, function names should be verbs

```typescript
// ❌ Avoid
const d = new Date(); // elapsed time in days
function calc(u: User) {
  /* ... */
}

// ✅ Prefer
const elapsedTimeInDays = new Date();
function calculateUserSubscriptionFee(user: User) {
  /* ... */
}
```

### 2. Functions Should Be Small

- Functions should be 20 lines or less
- Blocks within if/else/while statements should be one line long
- Functions should not be large enough to hold nested structures

```typescript
// ❌ Avoid
function processOrder(order: Order) {
  // 50+ lines of processing logic
  if (order.items.length > 0) {
    for (const item of order.items) {
      if (item.isValid) {
        // More nested logic...
      }
    }
  }
  // More processing...
}

// ✅ Prefer
function processOrder(order: Order) {
  if (!hasValidItems(order)) return;

  const validItems = extractValidItems(order);
  const processedItems = processItems(validItems);
  return createProcessedOrder(order, processedItems);
}

function hasValidItems(order: Order): boolean {
  return order.items.length > 0 && order.items.some((item) => item.isValid);
}
```

### 3. Functions Should Do One Thing

- Functions should do one thing, do it well, and do it only
- If a function does more than one thing, extract the parts into separate functions
- Use the Single Level of Abstraction Principle

```typescript
// ❌ Avoid
function handleUserRegistration(userData: UserData) {
  // Validate data
  if (!userData.email || !userData.password) throw new Error("Invalid data");

  // Hash password
  const hashedPassword = bcrypt.hash(userData.password, 10);

  // Save to database
  const user = database.users.create({ ...userData, password: hashedPassword });

  // Send welcome email
  emailService.send(user.email, "Welcome!", getWelcomeTemplate(user));

  return user;
}

// ✅ Prefer
function registerUser(userData: UserData): User {
  validateUserData(userData);
  const secureUserData = createSecureUserData(userData);
  const user = saveUser(secureUserData);
  sendWelcomeEmail(user);
  return user;
}

function validateUserData(userData: UserData): void {
  if (!hasValidEmail(userData.email) || !hasValidPassword(userData.password)) {
    throw new Error("Email and password are required");
  }
}

function hasValidEmail(email: string | undefined): boolean {
  return Boolean(email && email.includes("@"));
}

function hasValidPassword(password: string | undefined): boolean {
  return Boolean(password && password.length >= 8);
}

function createSecureUserData(userData: UserData): SecureUserData {
  const hashedPassword = bcrypt.hash(userData.password, 10);
  return { ...userData, password: hashedPassword };
}
```

### 4. Don't Repeat Yourself (DRY)

- Every piece of knowledge must have a single, unambiguous representation
- Extract common functionality into reusable functions
- Use constants for repeated values

```typescript
// ❌ Avoid
function calculateDiscountForRegularUser(price: number): number {
  return price * 0.95; // 5% discount
}

function calculateDiscountForPremiumUser(price: number): number {
  return price * 0.85; // 15% discount
}

// ✅ Prefer
const DISCOUNT_RATES = {
  REGULAR: 0.05,
  PREMIUM: 0.15,
} as const;

function calculateDiscount(price: number, discountRate: number): number {
  return price * (1 - discountRate);
}

function calculateDiscountForRegularUser(price: number): number {
  return calculateDiscount(price, DISCOUNT_RATES.REGULAR);
}

function calculateDiscountForPremiumUser(price: number): number {
  return calculateDiscount(price, DISCOUNT_RATES.PREMIUM);
}
```

### 5. Comments Should Explain Why, Not What

- Good code is self-documenting
- Comments should explain business logic, not code logic
- Avoid redundant comments

```typescript
// ❌ Avoid
// Increment i by 1
i++;

// Check if user is active
if (user.isActive) {
  // ...
}

// ✅ Prefer
// Apply compound interest calculation based on federal regulation changes
const adjustedBalance = balance * (1 + interestRate);

// Prevent concurrent access during critical payment processing window
if (isPaymentProcessingActive) {
  throw new Error("Payment processing in progress");
}
```

### 6. Error Handling

- Use exceptions rather than return codes
- Don't return null - use Option/Maybe patterns or throw exceptions

```typescript
// ❌ Avoid
function getUser(id: string): User | null {
  try {
    return database.findUser(id);
  } catch {
    return null; // Lost error information
  }
}

// ✅ Prefer
function getUser(id: string): User {
  if (!isValidUserId(id)) {
    throw new Error("User ID is required");
  }

  const user = database.findUser(id);
  if (!user) {
    throw new Error(`User with ID ${id} not found`);
  }
  return user;
}

function isValidUserId(id: string): boolean {
  return Boolean(id && id.length > 0);
}

// Alternative with Option pattern
type Some<T> = { type: "some"; value: T };
type None = { type: "none" };
type Option<T> = Some<T> | None;

function findUser(id: string): Option<User> {
  const user = database.findUser(id);
  return user ? { type: "some", value: user } : { type: "none" };
}
```

### 7. Boy Scout Rule

- Leave the code cleaner than you found it
- Continuously improve code quality
- Refactor small things when you encounter them

```typescript
// ❌ Avoid (leaving technical debt)
function processData(data: any) {
  // TODO: Fix this later
  return data.map((item) => item.value);
}

// ✅ Prefer (clean it up now)
interface DataItem {
  value: string;
  id: number;
}

function extractValues(dataItems: DataItem[]): string[] {
  return dataItems.map((item) => item.value);
}
```

### 8. Single Responsibility Principle

- Each module/function should have only one reason to change
- Each module should be responsible for one actor
- High cohesion, low coupling

```typescript
// ❌ Avoid - mixing concerns in one module
const userOperations = {
  save: (user: User) => database.save(user),
  sendEmail: (user: User, message: string) =>
    emailService.send(user.email, message),
  formatForDisplay: (user: User) => `${user.name} (${user.email})`,
};

// ✅ Prefer - separate modules for separate concerns
// userRepository.ts
function saveUser(user: User): void {
  database.save(user);
}

function findUserById(id: string): User | null {
  return database.findUser(id);
}

// userEmailService.ts
function sendEmailToUser(user: User, message: string): void {
  emailService.send(user.email, message);
}

// userFormatter.ts
function formatUserForDisplay(user: User): string {
  return `${user.name} (${user.email})`;
}
```

### 9. Dependency Inversion Principle

- Depend on abstractions, not concretions
- High-level modules should not depend on low-level modules
- Use dependency injection via function parameters

```typescript
// ❌ Avoid - direct dependencies
function processOrder(order: Order): void {
  const database = new PostgresDatabase(); // Direct dependency
  database.save(order);

  const emailService = new EmailService(); // Direct dependency
  emailService.send(order.customerEmail, "Order confirmed");
}

// ✅ Prefer - inject dependencies as parameters
type EmailSender = {
  send: (to: string, subject: string, body: string) => void;
};

type OrderRepository = {
  save: (order: Order) => void;
};

type OrderServiceDeps = {
  emailSender: EmailSender;
  orderRepository: OrderRepository;
};

function processOrder(deps: OrderServiceDeps, order: Order): void {
  deps.orderRepository.save(order);
  deps.emailSender.send(order.customerEmail, "Order confirmed", "Thank you!");
}

// Or create a configured service
function createOrderService(deps: OrderServiceDeps) {
  return {
    processOrder: (order: Order) => {
      deps.orderRepository.save(order);
      deps.emailSender.send(
        order.customerEmail,
        "Order confirmed",
        "Thank you!",
      );
    },
  };
}
```

### 10. Use Intention-Revealing Names for Boolean Functions

- Boolean functions should answer a yes/no question
- Use is, has, can, should prefixes

```typescript
// ❌ Avoid
function user(u: User): boolean {
  return u.role === "admin";
}

function password(pwd: string): boolean {
  return pwd.length >= 8;
}

// ✅ Prefer
function isUserAdmin(user: User): boolean {
  return user.role === "admin";
}

function hasValidPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
  );
}

function canUserAccessResource(user: User, resource: Resource): boolean {
  return user.permissions.includes(resource.requiredPermission);
}
```
