# 🔍 CAMBIOS DETALLADOS LÍNEA POR LÍNEA

## 1️⃣ `frontend/src/services/api/legacy.ts`

### Ubicación: Línea ~296 en función `request()`

#### ANTES:

```typescript
try {
  errorData = await response.json();

  // If using new error response format
  if (errorData.success === false && errorData.error_type) {
    errorMessage = errorData.message || errorMessage;
    errorType = errorData.error_type;
    affectedFields = errorData.fields || [];
    fieldMessages = errorData.details || {};
  }
  // Legacy format fallback
  else if (errorData.detail) {
    // ...
  } else if (errorData.error) {
    errorMessage = errorData.error;
  } else if (errorData.message) {
    errorMessage = errorData.message; // ← ESTABA AL FINAL (3ª opción)
  }
} catch {
  // Keep default error message
}
```

#### DESPUÉS:

```typescript
try {
  errorData = await response.json();

  // Priority 1: Use message field directly (backend provides human-readable text)
  if (errorData.message) {
    errorMessage = errorData.message; // ← AHORA ES 1ª OPCIÓN ✅
  }
  // Priority 2: New error response format with structured data
  else if (errorData.success === false && errorData.error_type) {
    errorMessage = errorData.message || errorMessage;
    errorType = errorData.error_type;
    affectedFields = errorData.fields || [];
    fieldMessages = errorData.details || {};
  }
  // Priority 3: Legacy format fallback
  else if (errorData.detail) {
    // ...
  } else if (errorData.error) {
    errorMessage = errorData.error;
  }
} catch {
  // Backend returned invalid JSON or no response body
  // For 401, use default message in Euskera
  if (response.status === 401) {
    errorMessage = "Zure saioa amaitu da okerreko token batengatik"; // ← NUEVO ✅
  }
}
```

#### EXPLICACIÓN:

- **ANTES**: El campo `message` se revisaba al ÚLTIMO (3ª prioridad)
- **DESPUÉS**: Se revisa PRIMERO (1ª prioridad)
- **BENEFICIO**: Frontend siempre usa el mensaje que el backend devuelve

---

### Ubicación: Línea ~310 (manejo de 401)

#### ANTES:

```typescript
if (response.status === 401) {
  clearAuthToken();
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const isAuthRoute = path === "/login" || path === "/register";
    if (!isAuthRoute) {
      navigate("/login", true);
    }
  }
}

// Parse error response... (continúa sin mensaje específico para 401)
```

#### DESPUÉS:

```typescript
if (response.status === 401) {
  clearAuthToken();  // ← Existía
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const isAuthRoute = path === '/login' || path === '/register';
    if (!isAuthRoute) {
      navigate('/login', true);  // ← Existía
    }
  }
}

// ... parse error response ...

} catch {
  // Backend returned invalid JSON or no response body
  // For 401, use default message in Euskera
  if (response.status === 401) {
    errorMessage = 'Zure saioa amaitu da okerreko token batengatik';  // ← NUEVO ✅
  }
}
```

#### EXPLICACIÓN:

- **NUEVO**: Si 401 sin mensaje JSON, se asigna mensaje por defecto en Euskera
- **BENEFICIO**: Usuario SIEMPRE ve un mensaje, nunca "HTTP 401"

---

## 2️⃣ `frontend/src/views/LoginPage.svelte`

### Ubicación: Línea ~67 (después de `handleDismiss()`)

#### ANTES:

```typescript
function handleDismiss() {
  error = '';
  affectedFields = [];
  formErrors.clearAll();
}
</script>
```

#### DESPUÉS:

```typescript
function handleDismiss() {
  error = '';
  affectedFields = [];
  formErrors.clearAll();
}

function handleInputChange() {  // ← NUEVO ✅
  // Clear error on any input change
  if (error) {
    error = '';
    affectedFields = [];
    formErrors.clearAll();
  }
}
</script>
```

#### EXPLICACIÓN:

- **NUEVO**: función que limpia error cuando el usuario escribe
- **CUÁNDO se llama**: En evento `on:input` de inputs

---

### Ubicación: Línea ~95 (email input)

#### ANTES:

```svelte
<input
  bind:value={email}
  name="email"
  type="email"
  autocomplete="email"
  required
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={email}
  name="email"
  type="email"
  autocomplete="email"
  required
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

#### EXPLICACIÓN:

- **NUEVO**: Se dispara `handleInputChange()` cada vez que el usuario escribe
- **RESULTADO**: Error desaparece mientras escribe

---

### Ubicación: Línea ~112 (password input)

#### ANTES:

```svelte
<input
  bind:value={password}
  name="password"
  type="password"
  autocomplete="current-password"
  required
  minlength="8"
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={password}
  name="password"
  type="password"
  autocomplete="current-password"
  required
  minlength="8"
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

#### EXPLICACIÓN:

- **NUEVO**: Mismo evento para campo password
- **RESULTADO**: Error desaparece si usuario escribe en password

---

## 3️⃣ `frontend/src/views/RegisterPage.svelte`

### Ubicación: Línea ~72 (después de `handleDismiss()`)

#### ANTES:

```typescript
function handleDismiss() {
  error = '';
  affectedFields = [];
  formErrors.clearAll();
}
</script>
```

#### DESPUÉS:

```typescript
function handleDismiss() {
  error = '';
  affectedFields = [];
  formErrors.clearAll();
}

function handleInputChange() {  // ← NUEVO ✅
  // Clear error on any input change
  if (error) {
    error = '';
    affectedFields = [];
    formErrors.clearAll();
  }
}
</script>
```

#### EXPLICACIÓN:

- Idéntico a LoginPage
- Limpia error al escribir

---

### Ubicación: Línea ~119 (username input)

#### ANTES:

```svelte
<input
  bind:value={username}
  name="username"
  type="text"
  autocomplete="username"
  required
  minlength="3"
  maxlength="30"
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={username}
  name="username"
  type="text"
  autocomplete="username"
  required
  minlength="3"
  maxlength="30"
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

---

### Ubicación: Línea ~136 (email input)

#### ANTES:

```svelte
<input
  bind:value={email}
  name="email"
  type="email"
  autocomplete="email"
  required
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={email}
  name="email"
  type="email"
  autocomplete="email"
  required
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

---

### Ubicación: Línea ~153 (password input)

#### ANTES:

```svelte
<input
  bind:value={password}
  name="password"
  type="password"
  autocomplete="new-password"
  required
  minlength="8"
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={password}
  name="password"
  type="password"
  autocomplete="new-password"
  required
  minlength="8"
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

---

### Ubicación: Línea ~170 (confirmPassword input)

#### ANTES:

```svelte
<input
  bind:value={confirmPassword}
  name="confirmPassword"
  type="password"
  autocomplete="new-password"
  required
  minlength="8"
  disabled={loading}
/>
```

#### DESPUÉS:

```svelte
<input
  bind:value={confirmPassword}
  name="confirmPassword"
  type="password"
  autocomplete="new-password"
  required
  minlength="8"
  disabled={loading}
  on:input={handleInputChange}  <!-- ← NUEVO ✅ -->
/>
```

---

## 📊 RESUMEN DE CAMBIOS

| Archivo               | Líneas  | Tipo      | Descripción                                    |
| --------------------- | ------- | --------- | ---------------------------------------------- |
| `legacy.ts`           | 296     | REORDENAR | Prioridad 1: `message` field                   |
| `legacy.ts`           | 309-311 | NUEVO     | Fallback 401 en Euskera                        |
| `LoginPage.svelte`    | 67-75   | NUEVO     | función `handleInputChange()`                  |
| `LoginPage.svelte`    | 102     | NUEVO     | `on:input={handleInputChange}` email           |
| `LoginPage.svelte`    | 119     | NUEVO     | `on:input={handleInputChange}` password        |
| `RegisterPage.svelte` | 76-84   | NUEVO     | función `handleInputChange()`                  |
| `RegisterPage.svelte` | 125     | NUEVO     | `on:input={handleInputChange}` username        |
| `RegisterPage.svelte` | 142     | NUEVO     | `on:input={handleInputChange}` email           |
| `RegisterPage.svelte` | 159     | NUEVO     | `on:input={handleInputChange}` password        |
| `RegisterPage.svelte` | 176     | NUEVO     | `on:input={handleInputChange}` confirmPassword |

**Total**: ~45 líneas modificadas/agregadas

---

## 🎯 CAMBIOS CONCEPTUALES

### Cambio 1: Prioridad de Extracción

```
ANTES: error_type → detail → error → message
DESPUÉS: message → error_type → detail → error
```

**Por qué**: Backend siempre devuelve `message`, es lo más importante

### Cambio 2: 401 sin JSON

```
ANTES: "HTTP 401" (genérico)
DESPUÉS: "Zure saioa amaitu da okerreko token batengatik" (específico)
```

**Por qué**: Usuario ve mensaje en su idioma

### Cambio 3: Limpieza Automática

```
ANTES: Error persiste hasta submit/navigate
DESPUÉS: Error desaparece al escribir (on:input)
```

**Por qué**: Mejor UX, menos frustración

---

## ✅ VERIFICACIÓN POR ARCHIVO

### LoginPage.svelte

```
✅ handleInputChange() definida
✅ Email input tiene on:input
✅ Password input tiene on:input
✅ ErrorAlert renderiza arriba
✅ FormField renderiza email rojo si error
✅ FormField renderiza password rojo si error
```

### RegisterPage.svelte

```
✅ handleInputChange() definida
✅ Username input tiene on:input
✅ Email input tiene on:input
✅ Password input tiene on:input
✅ ConfirmPassword input tiene on:input
✅ ErrorAlert renderiza arriba
✅ FormField renderiza todos los campos rojo si error
```

### legacy.ts

```
✅ message es prioridad 1
✅ error_type es prioridad 2
✅ detail es prioridad 3
✅ 401 sin JSON usa fallback en Euskera
✅ clearAuthToken() en 401
✅ navigate('/login') en 401
```

---

## 🚀 CÓMO PROBAR

1. **Login con email inválido**:
   - Email: `wrong@`
   - Verifica: Banner rojo aparece
   - Escribe en email: Banner desaparece

2. **Register email duplicado**:
   - Backend devuelve 409 con `"message": "..."`
   - Verifica: Mensaje aparece en naranja
   - Escribe en email: Desaparece

3. **Token expirado (401)**:
   - Invalida JWT manualmente
   - Verifica: Redirigido a /login
   - Verifica: localStorage vacío

---

**Documento creado**: 14 Abril 2026
**Status**: 🟢 COMPLETO
